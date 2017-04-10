const http = require('http');
const fs = require('fs');
const requestModule = require('request');
const sqlite3 = require('sqlite3').verbose();  

const hostname = '127.0.0.1';
const port = 3000;
//var staticChampInfo;

//Server Set Up
///////////////////////////////////////////////////////////////////////////////////

const server = http.createServer(function(request, response) {
	console.log('URL ' + request.url + ' has been requested');
	route(request, response);
});

server.listen(port, function(){
	console.log('up');
});

storeSummonerInfo(-4,1);


//Routing
////////////////////////////////////////////////////////////////////////////////////

//Handles all URL requests, including 404s
//(http, http)
function route(request, response) {
	if (request.url === '/') {
		homeRoute(request, response);

	} else if (request.url.includes('/script.js')) {
		jsRoute(request, response);

	} else if (request.url.includes('/user/')) {
		userRoute(request, response);

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

//User page
//!!split into user/champions, user/matches, user/fizz
//!!should check db BEFORE contacting riot
function userRoute(request, response) {
	var userName = request.url.replace('/user/', '');
	userName = userName.toLowerCase();
	userName = userName.replace(/ /g, ''); 	//!! perform additional checks on username. currently doing lowercase, whitespace and %20. make into function
	userName = userName.replace(/%20/g, '');

	fs.readFile('index.html',function (err, data) {
	    response.writeHead(200, {'Content-Type': 'text/html'});
	    response.write(data);

	    getSummonerID(userName, function(summonerID) { //success callback
	    	response.write(userName);
	    	response.end(console.log(userName + "'s page has been written"));
	    	storeSummonerInfo(summonerID, userName);

	    }, function() { //error callback
	    	response.write(userName + ' probably does not exist');
	    	response.end(console.log(userName + "'s page has been written, but no data was returned from riot"));
	    });
	});
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

//(string, function, function(int))
function getSummonerID(summonerName, callback, errorCallback) {
    requestModule.get('https://na.api.pvp.net/api/lol/na/v1.4/summoner/by-name/' + summonerName + '?api_key=RGAPI-2195a578-54d6-408b-bbef-c7a173bbe105',
    function (err, response, body) {
        console.log("Riot's statusCode for first request:", response && response.statusCode); // Print the response status code if a response was received
        if (response.statusCode != 200) {
            console.log('error:', err); //this is not the original error check. original was not triggering on a 404 response; this one does. the err variable, however, will still be undefined in those cases
            errorCallback();
            return; }
        else {
	        const allSummonerInfo = JSON.parse(body); //turns JSON text into object
	        const summonerID = allSummonerInfo[summonerName].id; //extracts the parameter we need
	        callback(summonerID);
    	}	
    });
};

//Databass
/////////////////////////////////////////////////////////////////////////////////////////

//(int, string)
function storeSummonerInfo(summonerID, summonerName){

	var idAlreadyInDB = false;

	//open db
	var db = new sqlite3.Database('db/everything.db', function(){
	  console.log('db opened');
	});
	//see if ID exists in table
	db.each("SELECT summonerID FROM summonerData", function(err, row) {  //this callback runs once for each row
		if(row.summonerID === summonerID){
			console.log(summonerID + ' is already in the db');
			idAlreadyInDB = true;
		}
	}, function (){						//this callback runs once everything else is done
		if (idAlreadyInDB === false) {
			db.run('INSERT INTO summonerData (summonerID, summonerName) VALUES (?, ?)', summonerID, summonerName);
			console.log('we added ' + summonerName + ' to the db');
		}
	});
};


//open db
	//get row with ID = summonerID
		//if that row's name != summonerName, set it equal to summonerName
		//else, do nothing
	//if no row is returned, insert new row with summonerID and summonerName