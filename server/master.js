var forky = require('forky'),
	_ = require('lodash');

forky(__dirname+'/app.js', function(err, cluster){

	_.each(cluster.workers, function(worker){

		worker.on('message', function(message){
      console.log("Received message from worker: ", worker.id, message);
			if(message.action == 'refresh'){
        console.log("Broadcasting reload message to "+_.toArray(cluster.workers).length+" nodes.");
				_.each(cluster.workers, function(worker){
          console.log("Sending to: ", worker.id);
					worker.send({action: 'reload'});
				});
			}
		});
	});

	console.log("Forky cluster has started! Nodes: "+ _.toArray(cluster.workers).length);
});
