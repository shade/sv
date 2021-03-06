var express = require('express');
var router = express.Router();
var util = require('util');
var moment = require('moment');
var bitcoinCore = require("bitcoin-core");
var qrcode = require('qrcode');
var bitcoinjs = require('bitcoinjs-lib');
var sha256 = require("crypto-js/sha256");
var hexEnc = require("crypto-js/enc-hex");
var Decimal = require("decimal.js");

var utils = require('./../app/utils.js');
var coins = require("./../app/coins.js");
var config = require("./../app/config.js");
var coreApi = require("./../app/api/coreApi.js");

router.get("/", function(req, res) {
	if (req.session.host == null || req.session.host.trim() == "") {
		if (req.cookies['rpc-host']) {
			res.locals.host = req.cookies['rpc-host'];
		}

		if (req.cookies['rpc-port']) {
			res.locals.port = req.cookies['rpc-port'];
		}

		if (req.cookies['rpc-username']) {
			res.locals.username = req.cookies['rpc-username'];
		}

		res.render("connect");
		res.end();

		return;
	}

	res.locals.homepage = true;

	var promises = [];

	promises.push(coreApi.getMempoolInfo());
	promises.push(coreApi.getMiningInfo());

	var chainTxStatsIntervals = [ 144, 144 * 7, 144 * 30, 144 * 265 ];
	res.locals.chainTxStatsLabels = [ "24 hours", "1 week", "1 month", "1 year", "All time" ];
	for (var i = 0; i < chainTxStatsIntervals.length; i++) {
		promises.push(coreApi.getChainTxStats(chainTxStatsIntervals[i]));
	}

	coreApi.getBlockchainInfo().then(function(getblockchaininfo) {
		res.locals.getblockchaininfo = getblockchaininfo;

		var blockHeights = [];
		if (getblockchaininfo.blocks) {
			for (var i = 0; i < 10; i++) {
				blockHeights.push(getblockchaininfo.blocks - i);
			}
		}

		promises.push(coreApi.getChainTxStats(getblockchaininfo.blocks - 1));

		coreApi.getBlocksByHeight(blockHeights).then(function(latestBlocks) {
			res.locals.latestBlocks = latestBlocks;

			Promise.all(promises).then(function(promiseResults) {
				res.locals.mempoolInfo = promiseResults[0];
				res.locals.miningInfo = promiseResults[1];

				var chainTxStats = [];
				for (var i = 0; i < res.locals.chainTxStatsLabels.length; i++) {
					chainTxStats.push(promiseResults[i + 2]);
				}

				res.locals.chainTxStats = chainTxStats;

				res.render("index");
			});
		});
	}).catch(function(err) {
		res.locals.userMessage = "Error loading recent blocks: " + err;

		res.render("index");
	});
});

router.get("/node-status", function(req, res) {
	coreApi.getBlockchainInfo().then(function(getblockchaininfo) {
		res.locals.getblockchaininfo = getblockchaininfo;

		coreApi.getNetworkInfo().then(function(getnetworkinfo) {
			res.locals.getnetworkinfo = getnetworkinfo;

			coreApi.getUptimeSeconds().then(function(uptimeSeconds) {
				res.locals.uptimeSeconds = uptimeSeconds;

				coreApi.getNetTotals().then(function(getnettotals) {
					res.locals.getnettotals = getnettotals;

					res.render("node-status");

				}).catch(function(err) {
					res.locals.userMessage = "Error getting node status: (id=0), err=" + err;

					res.render("node-status");
				});
			}).catch(function(err) {
				res.locals.userMessage = "Error getting node status: (id=1), err=" + err;

				res.render("node-status");
			});
		}).catch(function(err) {
			res.locals.userMessage = "Error getting node status: (id=2), err=" + err;

			res.render("node-status");
		});
	}).catch(function(err) {
		res.locals.userMessage = "Error getting node status: (id=3), err=" + err;

		res.render("node-status");
	});
});

router.get("/mempool-summary", function(req, res) {
	coreApi.getMempoolInfo().then(function(getmempoolinfo) {
		res.locals.getmempoolinfo = getmempoolinfo;

		coreApi.getMempoolStats().then(function(mempoolstats) {
			res.locals.mempoolstats = mempoolstats;

			res.render("mempool-summary");
		});
	}).catch(function(err) {
		res.locals.userMessage = "Error: " + err;

		res.render("mempool-summary");
	});
});

router.get("/peers", function(req, res) {
	coreApi.getPeerSummary().then(function(peerSummary) {
		res.locals.peerSummary = peerSummary;

		var peerIps = [];
		for (var i = 0; i < peerSummary.getpeerinfo.length; i++) {
			var ipWithPort = peerSummary.getpeerinfo[i].addr;
			if (ipWithPort.lastIndexOf(":") >= 0) {
				var ip = ipWithPort.substring(0, ipWithPort.lastIndexOf(":"));
				if (ip.trim().length > 0) {
					peerIps.push(ip.trim());
				}
			}
		}

		if (peerIps.length > 0) {
			utils.geoLocateIpAddresses(peerIps).then(function(results) {
				res.locals.peerIpSummary = results;
				
				res.render("peers");
			});
		} else {
			res.render("peers");
		}
	}).catch(function(err) {
		res.locals.userMessage = "Error: " + err;

		res.render("peers");
	});
});

router.post("/connect", function(req, res) {
	var host = req.body.host;
	var port = req.body.port;
	var username = req.body.username;
	var password = req.body.password;

	res.cookie('rpc-host', host);
	res.cookie('rpc-port', port);
	res.cookie('rpc-username', username);

	req.session.host = host;
	req.session.port = port;
	req.session.username = username;

	var client = new bitcoinCore({
		host: host,
		port: port,
		username: username,
		password: password,
		timeout: 30000
	});

	console.log("created client: " + client);

	global.client = client;

	req.session.userMessage = "<strong>Connected via RPC</strong>: " + username + " @ " + host + ":" + port;
	req.session.userMessageType = "success";

	res.redirect("/");
});

router.get("/changeSetting", function(req, res) {
	if (req.query.name) {
		req.session[req.query.name] = req.query.value;

		res.cookie('user-setting-' + req.query.name, req.query.value);
	}

	res.redirect(req.headers.referer);
});

router.get("/search", function(req, res) {
	if (!req.body.query) {
		req.session.userMessage = "Enter a block height, block hash, or transaction id.";
		req.session.userMessageType = "primary";

		res.render("search");

		return;
	}
});

router.post("/search", function(req, res) {
	if (!req.body.query) {
		req.session.userMessage = "Enter a block height, block hash, or transaction id.";

		res.redirect("/");

		return;
	}

	var query = req.body.query.toLowerCase().trim();
	var rawCaseQuery = req.body.query.trim();

	req.session.query = req.body.query;

	if (query.length == 64) {
		coreApi.getRawTransaction(query).then(function(tx) {
			if (tx) {
				res.redirect("/tx/" + query);

				return;
			}

			coreApi.getBlockByHash(query).then(function(blockByHash) {
				if (blockByHash) {
					res.redirect("/block/" + query);

					return;
				}

				coreApi.getAddress(rawCaseQuery).then(function(validateaddress) {
					if (validateaddress && validateaddress.isvalid) {
						res.redirect("/address/" + rawCaseQuery);

						return;
					}
				});

				req.session.userMessage = "No results found for query: " + query;

				res.redirect("/");

			}).catch(function(err) {
				req.session.userMessage = "No results found for query: " + query;

				res.redirect("/");
			});

		}).catch(function(err) {
			coreApi.getBlockByHash(query).then(function(blockByHash) {
				if (blockByHash) {
					res.redirect("/block/" + query);

					return;
				}

				req.session.userMessage = "No results found for query: " + query;

				res.redirect("/");

			}).catch(function(err) {
				req.session.userMessage = "No results found for query: " + query;

				res.redirect("/");
			});
		});

	} else if (!isNaN(query)) {
		coreApi.getBlockByHeight(parseInt(query)).then(function(blockByHeight) {
			if (blockByHeight) {
				res.redirect("/block-height/" + query);

				return;
			}

			req.session.userMessage = "No results found for query: " + query;

			res.redirect("/");
		});
	} else {
		coreApi.getAddress(rawCaseQuery).then(function(validateaddress) {
			if (validateaddress && validateaddress.isvalid) {
				res.redirect("/address/" + rawCaseQuery);

				return;
			}

			req.session.userMessage = "No results found for query: " + rawCaseQuery;

			res.redirect("/");
		});
	}
});

router.get("/block-height/:blockHeight", function(req, res) {
	var blockHeight = parseInt(req.params.blockHeight);

	res.locals.blockHeight = blockHeight;

	res.locals.result = {};

	var limit = config.site.blockTxPageSize;
	var offset = 0;

	if (req.query.limit) {
		limit = parseInt(req.query.limit);

		// for demo sites, limit page sizes
		if (config.demoSite && limit > config.site.blockTxPageSize) {
			limit = config.site.blockTxPageSize;

			res.locals.userMessage = "Transaction page size limited to " + config.site.blockTxPageSize + ". If this is your site, you can change or disable this limit in the site config.";
		}
	}

	if (req.query.offset) {
		offset = parseInt(req.query.offset);
	}

	res.locals.limit = limit;
	res.locals.offset = offset;
	res.locals.paginationBaseUrl = "/block-height/" + blockHeight;

	coreApi.getBlockByHeight(blockHeight).then(function(result) {
		res.locals.result.getblockbyheight = result;

		coreApi.getBlockByHashWithTransactions(result.hash, limit, offset).then(function(result) {
			res.locals.result.getblock = result.getblock;
			res.locals.result.transactions = result.transactions;
			res.locals.result.txInputsByTransaction = result.txInputsByTransaction;

			res.render("block");
		});
	});
});

router.get("/block/:blockHash", function(req, res) {
	var blockHash = req.params.blockHash;

	res.locals.blockHash = blockHash;

	res.locals.result = {};

	var limit = config.site.blockTxPageSize;
	var offset = 0;

	if (req.query.limit) {
		limit = parseInt(req.query.limit);

		// for demo sites, limit page sizes
		if (config.demoSite && limit > config.site.blockTxPageSize) {
			limit = config.site.blockTxPageSize;

			res.locals.userMessage = "Transaction page size limited to " + config.site.blockTxPageSize + ". If this is your site, you can change or disable this limit in the site config.";
		}
	}

	if (req.query.offset) {
		offset = parseInt(req.query.offset);
	}

	res.locals.limit = limit;
	res.locals.offset = offset;
	res.locals.paginationBaseUrl = "/block/" + blockHash;

	// TODO handle RPC error
	coreApi.getBlockByHashWithTransactions(blockHash, limit, offset).then(function(result) {
		res.locals.result.getblock = result.getblock;
		res.locals.result.transactions = result.transactions;
		res.locals.result.txInputsByTransaction = result.txInputsByTransaction;

		res.render("block");
	});
});

router.get("/tx/:transactionId", function(req, res) {
	var txid = req.params.transactionId;

	var output = -1;
	if (req.query.output) {
		output = parseInt(req.query.output);
	}

	res.locals.txid = txid;
	res.locals.output = output;

	res.locals.result = {};

	coreApi.getRawTransaction(txid).then(function(rawTxResult) {
		res.locals.result.getrawtransaction = rawTxResult;

		client.command('getblock', rawTxResult.blockhash, function(err3, result3, resHeaders3) {
			res.locals.result.getblock = result3;

			var txids = [];
			for (var i = 0; i < rawTxResult.vin.length; i++) {
				if (!rawTxResult.vin[i].coinbase) {
					txids.push(rawTxResult.vin[i].txid);
				}
			}

			coreApi.getRawTransactions(txids).then(function(txInputs) {
				res.locals.result.txInputs = txInputs;

				res.render("transaction");
			});
		});
	}).catch(function(err) {
		res.locals.userMessage = "Failed to load transaction with txid=" + txid + ": " + err;

		res.render("transaction");
	});
});

router.get("/address/:address", function(req, res) {
	var limit = config.site.addressTxPageSize;
	var offset = 0;
	var sort = "desc";

	
	if (req.query.limit) {
		limit = parseInt(req.query.limit);

		// for demo sites, limit page sizes
		if (config.demoSite && limit > config.site.addressTxPageSize) {
			limit = config.site.addressTxPageSize;

			res.locals.userMessage = "Transaction page size limited to " + config.site.addressTxPageSize + ". If this is your site, you can change or disable this limit in the site config.";
		}
	}

	if (req.query.offset) {
		offset = parseInt(req.query.offset);
	}

	if (req.query.sort) {
		sort = req.query.sort;
	}


	var address = req.params.address;

	res.locals.address = address;
	res.locals.limit = limit;
	res.locals.offset = offset;
	res.locals.sort = sort;
	res.locals.paginationBaseUrl = ("/address/" + address + "?sort=" + sort);
	res.locals.transactions = [];
	
	res.locals.result = {};

	try {
		res.locals.addressObj = bitcoinjs.address.fromBase58Check(address);

	} catch (err) {
		console.log("Error u3gr02gwef: " + err);

		try {
			res.locals.addressObj = bitcoinjs.address.fromBech32(address);

		} catch (err2) {
			console.log("Error u02qg02yqge: " + err2);
		}
	}

	if (global.miningPoolsConfigs) {
		for (var i = 0; i < global.miningPoolsConfigs.length; i++) {
			if (global.miningPoolsConfigs[i].payout_addresses[address]) {
				res.locals.payoutAddressForMiner = global.miningPoolsConfigs[i].payout_addresses[address];
			}
		}
	}

	res.locals.advancedFunctionality = (global.electrumApi != null);

	coreApi.getAddress(address).then(function(validateaddressResult) {
		res.locals.result.validateaddress = validateaddressResult;

		var promises = [];
		if (global.electrumApi) {
			var addrScripthash = hexEnc.stringify(sha256(hexEnc.parse(validateaddressResult.scriptPubKey)));
			addrScripthash = addrScripthash.match(/.{2}/g).reverse().join("");

			res.locals.electrumScripthash = addrScripthash;

			promises.push(new Promise(function(resolve, reject) {
				electrumApi.getAddressBalance(addrScripthash).then(function(result) {
					res.locals.balance = result;

					res.locals.electrumBalance = result;

					resolve();

				}).catch(function(err) {
					reject(err);
				});
			}));

			promises.push(new Promise(function(resolve, reject) {
				electrumApi.getAddressTxids(addrScripthash).then(function(result) {
					var txidResult = null;

					if (result.conflictedResults) {
						res.locals.conflictedTxidResults = true;

						txidResult = result.conflictedResults[0];

					} else if (result.result != null) {
						txidResult = result;
					}

					res.locals.electrumHistory = txidResult;

					var txids = [];
					var blockHeightsByTxid = {};

					if (txidResult) {
						for (var i = 0; i < txidResult.result.length; i++) {
							txids.push(txidResult.result[i].tx_hash);
							blockHeightsByTxid[txidResult.result[i].tx_hash] = txidResult.result[i].height;
						}
					}

					if (sort == "desc") {
						txids = txids.reverse();
					}

					res.locals.txids = txids;

					var pagedTxids = [];
					for (var i = offset; i < (offset + limit); i++) {
						if (txids.length > i) {
							pagedTxids.push(txids[i]);
						}
					}

					if (txidResult && txidResult.result != null) {
						// since we always request the first txid (to determine "first seen" info for the address),
						// remove it for proper paging
						pagedTxids.unshift(txidResult.result[0].tx_hash);
					}
					
					coreApi.getRawTransactionsWithInputs(pagedTxids).then(function(rawTxResult) {
						// first result is always the earliest tx, but doesn't fit into the current paging;
						// store it as firstSeenTransaction then remove from list
						res.locals.firstSeenTransaction = rawTxResult.transactions[0];
						rawTxResult.transactions.shift();

						res.locals.transactions = rawTxResult.transactions;
						res.locals.txInputsByTransaction = rawTxResult.txInputsByTransaction;
						res.locals.blockHeightsByTxid = blockHeightsByTxid;

						var addrGainsByTx = {};
						var addrLossesByTx = {};

						res.locals.addrGainsByTx = addrGainsByTx;
						res.locals.addrLossesByTx = addrLossesByTx;

						for (var i = 0; i < rawTxResult.transactions.length; i++) {
							var tx = rawTxResult.transactions[i];
							var txInputs = rawTxResult.txInputsByTransaction[tx.txid];

							for (var j = 0; j < tx.vout.length; j++) {
								if (tx.vout[j].value > 0 && tx.vout[j].scriptPubKey && tx.vout[j].scriptPubKey.addresses && tx.vout[j].scriptPubKey.addresses.includes(address)) {
									if (addrGainsByTx[tx.txid] == null) {
										addrGainsByTx[tx.txid] = new Decimal(0);
									}

									addrGainsByTx[tx.txid] = addrGainsByTx[tx.txid].plus(new Decimal(tx.vout[j].value));
								}
							}

							for (var j = 0; j < tx.vin.length; j++) {
								var txInput = txInputs[j];

								if (txInput != null) {
									for (var k = 0; k < txInput.vout.length; k++) {
										if (txInput.vout[k] && txInput.vout[k].scriptPubKey && txInput.vout[k].scriptPubKey.addresses && txInput.vout[k].scriptPubKey.addresses.includes(address)) {
											if (addrLossesByTx[tx.txid] == null) {
												addrLossesByTx[tx.txid] = new Decimal(0);
											}

											addrLossesByTx[tx.txid] = addrLossesByTx[tx.txid].plus(new Decimal(txInput.vout[k].value));
										}
									}
								}
							}

							//console.log("tx: " + JSON.stringify(tx));
							//console.log("txInputs: " + JSON.stringify(txInputs));
						}

						resolve();

					}).catch(function(err) {
						console.log("Error asdgf07uh23: " + err + ", error json: " + JSON.stringify(err));

						reject(err);
					});
				
				}).catch(function(err) {
					res.locals.electrumHistoryError = err;

					console.log("Error 23t07ug2wghefud: " + err + ", error json: " + JSON.stringify(err));

					reject(err);
				});
			}));

			promises.push(new Promise(function(resolve, reject) {
				coreApi.getBlockchainInfo().then(function(getblockchaininfo) {
					res.locals.getblockchaininfo = getblockchaininfo;

					resolve();

				}).catch(function(err) {
					console.log("Error 132r80h32rh: " + err + ", error json: " + JSON.stringify(err));

					reject(err);
				});
			}));
		}

		promises.push(new Promise(function(resolve, reject) {
			qrcode.toDataURL(address, function(err, url) {
				if (err) {
					console.log("Error 93ygfew0ygf2gf2: " + err);
				}

				res.locals.addressQrCodeUrl = url;

				resolve();
			});
		}));

		Promise.all(promises).then(function() {
			res.render("address");

		}).catch(function(err) {
			console.log("Error 32197rgh327g2: " + err + ", error json: " + JSON.stringify(err));

			res.render("address");
		});
		
	}).catch(function(err) {
		res.locals.userMessage = "Failed to load address " + address + " (" + err + ")";

		res.render("address");
	});
});

router.get("/rpc-terminal", function(req, res) {
	res.send("RPC Terminal Disabled")
});

router.get("/rpc-browser", function(req, res) {
	res.send("RPC Browser Disabled")
});

router.get("/unconfirmed-tx", function(req, res) {
	var limit = config.site.browseBlocksPageSize;
	var offset = 0;
	var sort = "desc";

	if (req.query.limit) {
		limit = parseInt(req.query.limit);
	}

	if (req.query.offset) {
		offset = parseInt(req.query.offset);
	}

	if (req.query.sort) {
		sort = req.query.sort;
	}

	res.locals.limit = limit;
	res.locals.offset = offset;
	res.locals.sort = sort;
	res.locals.paginationBaseUrl = "/unconfirmed-tx";

	coreApi.getMempoolDetails(offset, limit).then(function(mempoolDetails) {
		res.locals.mempoolDetails = mempoolDetails;

		res.render("unconfirmed-transactions");

	}).catch(function(err) {
		res.locals.userMessage = "Error: " + err;

		res.render("unconfirmed-transactions");
	});
});

router.get("/tx-stats", function(req, res) {
	res.send("TX Stats disabled");
});
/**
router.get("/fun", function(req, res) {
	var sortedList = coins[config.coin].historicalData;
	sortedList.sort(function(a, b){
		return ((a.date > b.date) ? 1 : -1);
	});

	res.locals.historicalData = sortedList;
	
	res.render("fun");
});
*/
module.exports = router;
