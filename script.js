var goToUserURL = function() {
	var x = document.getElementById('input').value;
	window.location.assign('/user/redir/' + x);
	console.log('ya clicked it.');
};