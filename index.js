var express = require('express'),
	path = require('path'),
	http = require('http'),
	https = require('https'),
	fs = require('fs'),
	async = require('async'),
	_ = require('lodash'),
	exphbs  = require('express3-handlebars'),
	rimraf = require('rimraf'),
	request = require('request'),
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

	//Clean up:

	// rimraf('/public/')

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
					if(error) return cb(error);
					cb(null, {
						name: album,
						art: _.map(files, function(filename){
							var src = '/website/albums/'+album+'/'+filename,
								name = path.basename(src, path.extname(src));
							return {
								name: name,
								thumbURL: client.thumbnailUrl(src, {size: 'medium'}),
								src: src,
								dest: './public/dist/'+album+'/'+filename,
								thumbDest: './public/dist/'+album+'/'+name+'.thumbnail'+path.extname(src)
							}
						})
					});
				});
			}, function(err, albums){
				if(err) next(err);

				//Remove old dist content, create new albums.
				async.series([
					_.partial(rimraf, './public/dist/'),
					_.partial(fs.mkdir, './public/dist/'),
				].concat(_.map(albums, function(a){
					return _.partial(fs.mkdir, './public/dist/'+a.name);
				})), function(err){
					if(err) return next(err);

					// Generate the list of the files to download (pic + thumbnail)

					function downloadThumb(url, dest, cb){
						console.log("thumb:",url,dest);
						var file = fs.createWriteStream(dest);
						request(url).pipe(file);
						file.on('finish', function() {
							console.log("finish!");
					    	file.close();
					    	cb();
					    });
					}

					function downloadPic(src, dest, cb) {
						console.log("Pic:",src,dest);
						client.readFile(src, function(error, data) {
							console.log("Pic error:",src,dest,error);
							if(error) return cb(error);
						  	fs.writeFile(dest, data, function(error) {
							    if(error) return cb(error);
							    console.log("Created "+dest);
							    cb();
							}); 
						});
					}

					var dl = _.reduce(albums, function(acc, a){
						

						var thumbs = _.map(a.art, function(p){
							return _.partial(downloadThumb, p.thumbURL, p.thumbDest);
						});

						var pics = _.map(a.art, function(p){
							return _.partial(downloadPic, p.src, p.dest);
						});

						console.log("partials", thumbs, pics);

						return acc.concat(thumbs).concat(pics);

						// acc.concat();
						// acc.concat(_.map(a.art, function(p){
						// 	return _.partial(downloadPic, p.src, p.dest);
						// }));
						// console.log(acc);
						// return acc;
					}, []);

					//Fire in the hole
					console.log("Downloading: "+dl.length+" files.");
					async.series(dl, function(error){
						if(error) return next(error);
						res.json(albums);
					});

					// console.log(dl);

					// _.each(albums, function(a){
					// 	_.each(a.art, function(p){
					// 		 var thumb = fs.createWriteStream(p.localThumbPath);
					// 		 var request = http.get(url, function(response) {
					// 		    response.pipe(file);
					// 		    file.on('finish', function() {
					// 		      file.close();
					// 		      cb();
					// 		    });
					// 		  });
					// 	});
					// })

					//All the albums folders are created, download the files
					// async.parallel() 
				});
			});
		};
	});	
});

app.get('/old', function(req, res, next){

	//Clean up:

	// rimraf('/public/')

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