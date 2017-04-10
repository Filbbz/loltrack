var goToUserURL = function() {
	var x = document.getElementById('input').value;
	window.location.assign('/user/' + x);
	console.log('ya clicked it.');
};