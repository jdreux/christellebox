var express = require('express'),
	path = require('path'),
	http = require('http'),
	async = require('async'),
	_ = require('lodash'),
	exphbs  = require('express3-handlebars'),
	Dropbox = require("dropbox"),
	client = new Dropbox.Client({
	    key: "do4maj0zi41t4jb",
	    secret: "6kzlbdpgo6xdmrq",
	    token: "MqSHzISeN_EAAAAAAAAAAdrtC29XoTviCS7QJFWMtU46d49oogHGzA--b-7b9794"
	}),
	art = require('./old/socatoa_christelledreuxcom.js'),
	app = express(),
	hbs = exphbs.create({
        extname: '.hbs',
        // defaultLayout: 'main',
         helpers: {
            join: function(val, delimiter){
                if(val) return val.join(delimiter);
            },
            formatDate: function(date, format) {
                var momentDate = moment(date);
                return momentDate.format(format);
            },
            if_eq: function(a,b,options) {
                if (a == b)
                    return options.fn(this);
                return options.inverse(this);
            }
        }
    }),
	utils = {
		normalize: function(str) {
				
			return str
				.replace(/\&eacute;/g, 'é')
				.replace(/\&#39;/g, '\'')
				.replace(/\&egrave;/g, 'è')
				.replace(/\&agrave;/g, 'à')
				.replace(/\&ecirc;/g, 'ê')
				.replace(/\&acirc;/g, 'â')
				.replace(/\&Eacute;/g, 'é')
				.replace(/\&agrave;/g, 'à')
				.replace(/\&quot;/g, '"')
		}
	}

var pics = function () {

	var data = require('./old/socatoa_christelledreuxcom.js');

	console.log('data', data);

	return _.map(data.albums, function(a){
		return {
			name: utils.normalize(a.ALBUM_NAME),
			text: utils.normalize( (a.ALBUM_TEXT1 || '') + (a.ALBUM_TEXT2 || '')),
			art: _(data.pictures).filter({PICTURE_ALBUM_ID: a.ALBUM_ID}).map(function(p){
				return {
					name: utils.normalize(p.PICTURE_NAME),
					uri: '/img/art/'+p.PICTURE_ID
				}
			}).value()
		}
	});

}


app.configure(function(){

	app.engine('.hbs', hbs.engine);

    app.set('view engine', '.hbs');

    app.use(express.compress());


	//app.use(express.logger());
	app.use(app.router);
	app.use(express.static(path.join(__dirname,'./public')));
	app.use(express.static(path.join(__dirname,'./public')));

	app.use(function(req, res){
		res.status(404).sendfile('./public/404.html');
	});

	app.use(function(err){
		console.error(err);
		res.status(500).send('An error has occured');
	});
});

app.get('/dropbox/albums', function(req, res, next){

	// client.getAccountInfo(function(error, info){
	// 	console.log(error, info);
	// });

	// client.readdir('/website/albums/Iréel du Présent', function(error, info){
	// 	res.json({
	// 		error: error,
	// 		info: info
	// 	});
	// });

	// client.metadata('/website/albums/Iréel du Présent/cinquième.jpg', function(error, info){
	// 	res.json({
	// 		error: error,
	// 		info: info
	// 	});
	// });

	client.thumbnailUrl('/website/albums/Iréel du présent/cinquième.jpg', function(error, info){
		res.json({
			error: error,
			info: info
		});		
	});
});

app.get('/', function(req, res, next){

	var albums = [];

	client.readdir('/website/albums/', function(error, folders){

		if(error) {
			next(error);
		} else {
			// albums = _.map(folders, function(a){
			// 	return {
			// 		name: a,
			// 		art: []
			// 	}
			// });
			console.log("Got folders:", folders);
			async.map(folders, function(album, cb){
				client.readdir('/website/albums/'+album, function(error, files){
					if(error) cb(error);
					cb(null, {
						name: album,
						art: _.map(files, function(filename){
							var path = '/website/albums/'+album+'/'+filename;
							return {
								name: filename,
								small: client.thumbnailUrl(path, {size: 'medium'}),
								large: client.thumbnailUrl(path, {size: 'xl'})
							}
						})
					});
				});
			}, function(err, albums){
				if(err) next(err);
				// console.log("got albums:", albums)
				// res.json(albums);

				var items = _(albums).map(function(a, index) {
					return [{
						name: a.name,
						odd: index % 2 == 1
					}].concat(_.map(a.art, function(p){
						return {
							name: p.name,
							albumName: a.name,
							// uri: p.uri,
							small: p.small,
							large: p.large,
							odd: index % 2 == 1
						}
					}))
				}).flatten(true).value();

				var rows = _.reduce(items, function(acc, item){
					console.log(acc, item);

					if(acc.length == 2 && _.last(acc).length == 2) {
						_.last(acc).push({break: true});			
						_.last(acc).push(item);
						acc.push([]);
						return acc;
					}

					if(acc.length == 3 && _.last(acc).length == 3){
						_.last(acc).push({
							news: _(art.news).pluck('Content').map(utils.normalize).value().splice(0,2)
						});
						acc.push([]);
						return acc;			
					}

					if(_.last(acc).length == 6) {
						acc.push([]);
					} 

					_.last(acc).push(item);

					return acc;
				}, [[]]);

				console.log(rows);

				res.render('home', {
					rows: rows
				});

			});
		};
	});
	// return;

	// var albums = _.map(art.albums, function(a){
	// 	return {
	// 		name: utils.normalize(a.ALBUM_NAME),
	// 		text: utils.normalize( (a.ALBUM_TEXT1 || '') + (a.ALBUM_TEXT2 || '')),
	// 		art: _(art.pictures).filter({PICTURE_ALBUM_ID: a.ALBUM_ID}).map(function(p){
	// 			return {
	// 				name: utils.normalize(p.PICTURE_NAME),
	// 				uri: '/img/art/'+p.PICTURE_ID
	// 			}
	// 		}).value()
	// 	}
	// }); 

	
});


app.get('/pictures', function(req, res, next){

	res.json(pics());

});


http.createServer(app).listen(2000, function(){
	console.log("HTTP server listening on port 2000");
});