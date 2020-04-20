const commands = {
	time: function() {
		var d = new Date();
		var o = {hour: 'numeric', minute: 'numeric', hour12: true};
		var ts = d.toLocaleString('en-US', o);
		return ts;
	},
	random: function(a1, a2) {
		a1 = Number(a1) || 0;
		a2 = Number(a2) || 1;
		var r = Math.floor(Math.random() * (a1-a2+1)) + a2;
		return(r);
	},
	user: function() {
		return "AARON";
	},
    pause: function(pA) {
    	pA = Number(pA) || 1; //seconds to pause
    	var r = '';
    	for(var i=0; i<pA; i++){
    		r+='[PAUSE]'
    	};
    	return r;
    }
}

module.exports = commands;