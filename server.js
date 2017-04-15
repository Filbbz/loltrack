const http = require('http');
const fs = require('fs');
const requestModule = require('request');
const sqlite3 = require('sqlite3').verbose();  

const hostname = '127.0.0.1';
const port = 3000;

var activeSummonerID = 21462663; //!!assigned !!on log in
var staticChampInfo; //assigned on app start


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

	} else if (request.url.includes('/user/champions/')) {
		userChampionsRoute(request, response);

	} else if (request.url.includes('/user/history/')) {
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

	    getSummonerID(userInput, function(summonerName){ //success callback
	    	response.write('Hi ' + summonerName + ". You're logged in or something");
	    	mostPlayed();
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
	response.write('most played champ');
	response.write('# of games on said champ');
	response.write('win%');
	response.end(console.log('champions page has been written'));
};

//Match History page
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

//(string, function(string), function)
function getSummonerID(enteredName, callback, errorCallback) { //called first on log in
    requestModule.get('https://na.api.pvp.net/api/lol/na/v1.4/summoner/by-name/' + enteredName + '?api_key=RGAPI-2195a578-54d6-408b-bbef-c7a173bbe105',
    function (err, response, body) {
        console.log("Riot's statusCode for getSummonerID request:", response && response.statusCode); // Print the response status code if a response was received
        if (response.statusCode != 200) {
            console.log('error:', err); //not a 'real' error checker
            errorCallback();
            return; }
        else {
	        const allSummonerInfo = JSON.parse(body); //turns JSON text into object
	        const summonerID = allSummonerInfo[enteredName].id; //extracts the parameter we need
	        const displayName = allSummonerInfo[enteredName].name; //this is the summonerName correctly stylized
	        console.log('ID ' + summonerID + ' received');
	        callback(displayName);
	        getMatchHistory(summonerID);
    	}	
    });
};

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
        	saveMatchHistory(rawMatchData);
    	}	
    });
};

//()
function getStaticChampInfo() { //called on app start
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

//Databass
/////////////////////////////////////////////////////////////////////////////////////////
//(JSON object)
function saveMatchHistory(jason) { //called third on log in

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
};

//returns an array of sorted objects, each of which contains champ id, champ name, # of games played, # of wins, # of losses, win%
//(??)
function mostPlayed() {

	var statsArray = [];

	var db = new sqlite3.Database('db/everything.db', function() {
	  console.log('db opened');
	});

	

	//create object using staticChampInfo that has champ name, champ ID, and games logged
	//get every champion ID from db for a given player
	//for every instance of a champ ID from db, increase value of games logged
	//sort the object by games logged per champ
	//return the object
};