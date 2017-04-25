const http = require('http');
const fs = require('fs');
const requestModule = require('request');
const sqlite3 = require('sqlite3').verbose();  

const hostname = '127.0.0.1';
const port = 3000;

var staticChampInfo; //assigned on app start

//user-specific globals, assigned on log in
var activeSummonerID;
var activeUserName;
var activeStats = [];

//Server Set Up
///////////////////////////////////////////////////////////////////////////////////

const server = http.createServer(function(request, response) {
	console.log('URL ' + request.url + ' has been requested');
	route(request, response);
});

server.listen(port, function(){
	console.log('up');
});

getStaticChampInfo(); //on startup, sets staticChampInfo to a list of data from riot

//Routing
////////////////////////////////////////////////////////////////////////////////////

//Handles all URL requests
//(http, http)
function route(request, response) {
	if (request.url === '/') {
		homeRoute(request, response);

	} else if (request.url.includes('/script.js')) {
		jsRoute(request, response);

	} else if (request.url.includes('/user/redir/')) {
		userLogInRoute(request, response);

	} else if (request.url.includes('/user/' + activeUserName + '/champions')) {
		userChampionsRoute(request, response);

	} else if (request.url.includes('/user/' + activeUserName + '/history')) {
		userHistoryRoute(request, response);

	} else {
		badRoute(request, response);
	}
};

//Homepage
//(http, http)
function homeRoute(request, response) {
	fs.readFile('index.html',function (err, data) {
	    response.writeHead(200, {'Content-Type': 'text/html'});
	    response.write(data);
	    response.end(console.log("homepage has been written"));
	});
};

//!!User log in page- auto redirects to champs when loaded
//(http, http)
function userLogInRoute(request, response) {
	var userInput = request.url.replace('/user/redir/', '');
	userInput = userInput.toLowerCase();
	userInput = userInput.replace(/ /g, ''); 	//!! perform additional checks on username. currently doing lowercase, whitespace and %20. make into function
	userInput = userInput.replace(/%20/g, '');

	fs.readFile('index.html',function (err, data) {
	    response.writeHead(200, {'Content-Type': 'text/html'});
	    response.write(data);

	    //starts a chain of callbacks to complete the "log in" process
	    getSummonerID(userInput, function(summonerName){ //success callback
	    	activeUserName = userInput;
	    	response.write('Hi ' + summonerName + ". You're logged in or something");
	    	response.end(console.log(summonerName + "'s page has been written"));

	    }, function() { //error callback
	    	response.write('could not find ' + userInput);
	    	response.end(console.log('wrote page, but couldnt find ' + userInput));
	    });
	});
};

//Champions page
//(http, http)
function userChampionsRoute(request, response) {
	response.writeHead(200, {'Content-Type': 'text/html'});
	response.write('most played champ: ' + convertFromChampID(sortSums(activeStats, 'champID')[0].value) + '<br>');
	response.write('# of games logged on said champ: ' + sortSums(activeStats, 'champID')[0].sum + '<br>');
	response.write('win%: ' + calculateWinRate(activeStats, sortSums(activeStats, 'champID')[0].value));
	response.end(console.log('champions page has been written'));
};

//Match history page
//(http, http)
function userHistoryRoute(request, response) {
	response.end(console.log('history: under construction'));
};


//404 page
//(http, http)
function badRoute(request, response) { 
	response.writeHead(404, {'Content-Type': 'text/html'});
	response.write("<h2>404'd!</h2>");
	response.end(console.log("404 error page has been written"));
};

//script.js
//(http, http)
function jsRoute(request, response) {
	fs.readFile('script.js',function (err, data) {
		response.writeHead(200, {'Content-Type': 'text/javascript'});
		response.write(data);
	    response.end(console.log("script.js has been written"));
	});
};

//Contacting Rito
//////////////////////////////////////////////////////////////////////////////////////

//called on app start
//()
function getStaticChampInfo() {
	requestModule.get('https://na.api.pvp.net/api/lol/static-data/na/v1.2/champion?api_key=RGAPI-2195a578-54d6-408b-bbef-c7a173bbe105',
	function (err, response, body) {
       console.log("Riot's statusCode for second getStaticChampInfo request:", response && response.statusCode); // Print the response status code if a response was received
        if (response.statusCode != 200) {
            console.log('error:', err);
            return; }
		else {
			staticChampInfo = JSON.parse(body);
		}
    });
};

//log in order: 1
//(string, function(string), function)
function getSummonerID(enteredName, callback, errorCallback) {
    requestModule.get('https://na.api.pvp.net/api/lol/na/v1.4/summoner/by-name/' + enteredName + '?api_key=RGAPI-2195a578-54d6-408b-bbef-c7a173bbe105',
    function (err, response, body) {
        console.log("Riot's statusCode for getSummonerID request:", response && response.statusCode); // Print the response status code if a response was received
        if (response.statusCode != 200) {
            console.log('error:', err); //not a 'real' error checker
            errorCallback();
            return; }
        else {
	        const allSummonerInfo = JSON.parse(body); //turns JSON text into object
	        activeSummonerID = allSummonerInfo[enteredName].id; //extracts the parameter we need
	        const displayName = allSummonerInfo[enteredName].name; //this is the summonerName correctly stylized
	        console.log('ID ' + activeSummonerID + ' received');
	        callback(displayName);
	        getMatchHistory(activeSummonerID);
    	}	
    });
};

//log in order: 2
//(int)
function getMatchHistory(id) { //called second on log in
	requestModule.get('https://na.api.pvp.net/api/lol/na/v1.3/game/by-summoner/' + id + '/recent?api_key=RGAPI-2195a578-54d6-408b-bbef-c7a173bbe105',
    function (err, response, body) {
        console.log("Riot's statusCode for getMatchHistory request:", response && response.statusCode); // Print the response status code if a response was received
        if (response.statusCode != 200) {
            console.log('error:', err); //not a 'real' error checker
            errorCallback();
            return; }
        else {
        	const rawMatchData = JSON.parse(body);
        	saveAllData(rawMatchData, retrieveAllData);
    	}	
    });
};



//Databass
/////////////////////////////////////////////////////////////////////////////////////////

//log in order: 3
//(JSON object, function())
function saveAllData(jason, callback) {

	//massaging the data- separating ally and enemy champions
	for (i in jason.games) {
		jason.games[i].allies = [];
		jason.games[i].enemies = [];

		for (j in jason.games[i].fellowPlayers) {
			if (jason.games[i].teamId === jason.games[i].fellowPlayers[j].teamId) {
				jason.games[i].allies.push(jason.games[i].fellowPlayers[j].championId);
			} else {
				jason.games[i].enemies.push(jason.games[i].fellowPlayers[j].championId);
			}
		}
		//console.log('game id: ' + jason.games[i].gameId + ' allies: ' + jason.games[i].allies + '\nenemies: ' + jason.games[i].enemies);
	}

	var db = new sqlite3.Database('db/everything.db', function() { //open db
	  console.log('db opened');
	});

	//full match history contains ~10 games
	//each iteration of the loop checks db for data, then if not found, logs data for one game
	for (let i in jason.games) {
		let dataStored = false;
		//check each row to see if data is present
		db.each('SELECT * FROM rawMatchJSON WHERE summonerID = ?', jason.summonerId, function (err, row) {
			if(jason.games[i].gameId === row.gameID) {
				dataStored = true;
				//console.log('game id already in db');
			}
			//console.log('checking row:' + row.gameID);;
		}, function() { //this runs once all rows have been checked
			if(dataStored === false) {

				//writing to table allMatchJSON
				db.run('INSERT INTO rawMatchJSON (summonerID, gameID, rawJSON) VALUES (?, ?, ?)'
				, jason.summonerId, jason.games[i].gameId, JSON.stringify(jason.games[i]));
				//console.log("writing game id to rawMatchJSON: " + jason.games[i].gameId);
			}
		});
    }

    //now we do the same thing again, but with the actual important table: matchData
    for (let i in jason.games) {
		let dataStored = false; //!!
		db.each('SELECT * FROM matchData WHERE summonerID = ?', jason.summonerId, function (err, row) {
			if(jason.games[i].gameId === row.gameID) {
				dataStored = true;
			}
		}, function() {
			if(dataStored === false) {
				//writing to table matchData
				db.run('INSERT INTO matchData (summonerID, gameID, champID, gameMode, gameType, subType, mapID, result, \
				date, kills, deaths, assists, allies, enemies) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
				, jason.summonerId, jason.games[i].gameId, jason.games[i].championId, jason.games[i].gameMode
				, jason.games[i].gameType, jason.games[i].subType, jason.games[i].mapId, jason.games[i].stats.win
				, jason.games[i].createDate, jason.games[i].stats.championsKilled, jason.games[i].stats.numDeaths
				, jason.games[i].stats.assists, jason.games[i].allies.toString(), jason.games[i].enemies.toString());
				console.log("writing game id to matchData: " + jason.games[i].gameId);
			}
		});
    }

    callback();
};

//log in order: 4
//()
function retrieveAllData() {

	activeStats = []; //necessary to reset active stats when switching users

	//object representation a db row
	function DataRow(summonerID, gameID, champID
	, gameMode, gameType, subType, mapID, result
	, date, kills, deaths, assists, allies, enemies) {

		this.summonerID = summonerID;
		this.gameID = gameID;
		this.champID = champID;
		this.gameMode = gameMode;
		this.gameType = gameType;
		this.subType = subType;
		this.mapID = mapID;
		this.result = result;
		this.date = date;
		this.kills = kills;
		this.deaths = deaths;
		this.assists = assists;
		this.allies = allies;
		this.enemies = enemies;
	};

	var db = new sqlite3.Database('db/everything.db', function() {
	  console.log('db opened');
	});

	//feeds globle variable activeStats
	db.each('SELECT * FROM matchData WHERE summonerID = ?', activeSummonerID, function (err, row) {

		let myRow = new DataRow (row.summonerID, row.gameID, row.champID, row.gameMode, row.gameType, row.subType
		, row.mapID, row.result, row.date, row.kills, row.deaths, row.assists, row.allies, row.enemies);

		activeStats.push(myRow);

	}, function () {
		//console.log(activeSummonerID + "'s data: " + JSON.stringify(activeStats));
	});
};


//Fun With Functions
/////////////////////////////////////////////////////////////////////////////////////////

//!!convert champID to name
//(int) -> string
function convertFromChampID(champID) {

	for (i in staticChampInfo.data) {
		if (staticChampInfo.data[i].id === champID) {
			return staticChampInfo.data[i].name;
		}
	}

}

//takes a list of objects and sums up instances of a specified property.value of those objects
//([object], property, value) -> int
function count(stats, property, value) {

	var total = 0;
	var i = 0;

	while (i < stats.length) {
		if (stats[i][property] === value) {
			total++;
		}
		i++;
	}

	return total.toString();
};

//returns total for filtered results, ie (activeStats, ['champID', 'result'],[61, 1]) returns
//count of objects with champID 61 && result 1
//([object], [properties], [values]) -> int
function filterCount (stats, properties, values) {
	var total = 0;
	var i = 0;
	var j = 0;
	var subTotal = 0;

	while (i < stats.length) {
		j = 0;
		subTotal = 0;

		while (j < properties.length) {
			if (stats[i][properties[j]] === values[j]) {
				subTotal++;
				//console.log('a property matches- increasing subTotal to ' + subTotal);
			}
			if (subTotal === properties.length) {
				//console.log('all properties match- increasing total');
				total++;
			}
			j++;
		}
		i++;
	}
	return total;
};

//for every instance of a value, find its total number of occurences, then sort those values by their occorunces
//returns a sorted array of objects. Each object contains a value and sum. They are sorted by sum
//([object], string) -> [object] 
function sortSums(stats, property) {
	var uniqueValues = []; //ex. will contain [61, 35, 47]
	var sortMeBySum = []; //ex. will contain [{value: 61, sum: 20}, {value: 35, sum: 25}, {value: 47, sum: 1}]


	function ValueAndSum (value, sum) {
		this.value = value;
		this.sum = sum;
	}

	var i = 0;
	var j = 0;

	//get array full of unique values
	while (i < stats.length) {
		if (uniqueValues.includes(stats[i][property]) === false) {
			uniqueValues.push(stats[i][property]);
			i++;
		}
		else {
			i++;
		}
	}

	//gets sum for every value
	while (j < uniqueValues.length) {
		let myObj = new ValueAndSum(uniqueValues[j], count(stats, property, uniqueValues[j]));
		sortMeBySum.push(myObj);
		j++;
	}

	function reverseSortObjectBySum(a,b) {
		return b.sum - a.sum;
	};
	
    return sortMeBySum.sort(reverseSortObjectBySum);
};

//([object], int) -> float
function calculateWinRate(stats, champID) {
	
	var totalWins = filterCount(stats, ['champID', 'result'], [champID, '1']);
	var totalLosses = filterCount(stats, ['champID', 'result'], [champID, '0']);

	console.log('wins: ' + totalWins + ' losses: ' + totalLosses);
	return (totalWins/ (totalLosses + totalWins) * 100);
};