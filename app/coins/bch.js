var Decimal = require("decimal.js");
Decimal8 = Decimal.clone({ precision:8, rounding:8 });

var bchCurrencyUnits = [
	{
		name:"BCH",
		multiplier:1,
		default:true,
		values:["", "bch", "BCH"],
		decimalPlaces:8
	},
	{
		name:"mBCH",
		multiplier:1000,
		values:["mbch"],
		decimalPlaces:5
	},
	{
		name:"bits",
		multiplier:1000000,
		values:["bits"],
		decimalPlaces:2
	},
	{
		name:"sat",
		multiplier:100000000,
		values:["sat", "satoshi"],
		decimalPlaces:0
	}
];

module.exports = {
	name:"Bitcoin SV",
	ticker:"BCH",
	logoUrl:"/img/logo/sv.jpg",
	siteTitle:"Bitcoin SV Blockchain Explorer",
	nodeTitle:"Bitcoin Full Node",
	nodeUrl:"https://github.com/bitcoin-sv/bitcoin-sv",
	miningPoolsConfigUrls:[
		"https://raw.githubusercontent.com/blockchain/Blockchain-Known-Pools/master/pools.json",
		"https://raw.githubusercontent.com/btccom/Blockchain-Known-Pools-BCH/master/pools.json"
	],
	maxBlockWeight: 128000000,
	currencyUnits:bchCurrencyUnits,
	currencyUnitsByName:{"BCH":bchCurrencyUnits[0], "mBCH":bchCurrencyUnits[1], "bits":bchCurrencyUnits[2], "sat":bchCurrencyUnits[3]},
	baseCurrencyUnit:bchCurrencyUnits[3],
	feeSatoshiPerByteBucketMaxima: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 50, 75, 100, 150],
	genesisBlockHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
	genesisCoinbaseTransactionId: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
	genesisCoinbaseTransaction: {
		"hex": "01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0804ffff001d02fd04ffffffff0100f2052a01000000434104f5eeb2b10c944c6b9fbcfff94c35bdeecd93df977882babc7f3a2cf7f5c81d3b09a68db7f0e04f21de5d4230e75e6dbe7ad16eefe0d4325a62067dc6f369446aac00000000",
		"txid": "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
		"hash": "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
		"size": 204,
		"vsize": 204,
		"version": 1,
		"confirmations":475000,
		"vin": [
			{
				"coinbase": "04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73",
				"sequence": 4294967295
			}
		],
		"vout": [
			{
				"value": 50,
				"n": 0,
				"scriptPubKey": {
					"asm": "04f5eeb2b10c944c6b9fbcfff94c35bdeecd93df977882babc7f3a2cf7f5c81d3b09a68db7f0e04f21de5d4230e75e6dbe7ad16eefe0d4325a62067dc6f369446a OP_CHECKSIG",
					"hex": "4104f5eeb2b10c944c6b9fbcfff94c35bdeecd93df977882babc7f3a2cf7f5c81d3b09a68db7f0e04f21de5d4230e75e6dbe7ad16eefe0d4325a62067dc6f369446aac",
					"reqSigs": 1,
					"type": "pubkey",
					"addresses": [
						"1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
					]
				}
			}
		],
		"blockhash": "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
		"time": 1230988505,
		"blocktime": 1230988505
	},
	genesisCoinbaseOutputAddressScripthash:"8b01df4e368ea28f8dc0423bcf7a4923e3a12d307c875e47a0cfbf90b5c39161",
	historicalData: [
		{
			type: "blockheight",
			date: "2009-01-03",
			blockHeight: 0,
			blockHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
			summary: "The Bitcoin Genesis Block.",
			alertBodyHtml: "This is the first block in the Bitcoin blockchain, known as the 'Genesis Block'. This block was mined by Bitcoin's creator Satoshi Nakamoto. You can read more about <a href='https://en.bitcoin.it/wiki/Genesis_block'>the genesis block</a>.",
			referenceUrl: "https://en.bitcoin.it/wiki/Genesis_block"
		}
    ],
    exchangeRateData:{
		jsonUrl:"https://api.binance.com/api/v3/ticker/price",
		exchangedCurrencyName:"USDT",
		responseBodySelectorFunction:function(responseBody) {
    		if (responseBody) {
                ticker = responseBody.find((ticker) => (ticker.symbol == "BCHSVBTC"))
                if (ticker) {
                    usd = responseBody.find((ticker) => (ticker.symbol == "BTCUSDT"))
                    return ticker.price * usd.price
                }
            }
						
			return -1;
		}
	},
	blockRewardFunction:function(blockHeight) {
		var eras = [ new Decimal8(50) ];
		for (var i = 1; i < 34; i++) {
			var previous = eras[i - 1];
			eras.push(new Decimal8(previous).dividedBy(2));
		}

		var index = Math.floor(blockHeight / 210000);

		return eras[index];
	}
};