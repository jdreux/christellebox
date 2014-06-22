var express = require('express'),
	path = require('path'),
	http = require('http'),
	https = require('https'),
	fs = require('fs'),
	async = require('async'),
	_ = require('lodash'),
	exphbs  = require('express3-handlebars'),
	Q = require('q'),
	lockFile = require('lockfile'),
	mkdirp = require('mkdirp'),
	rimraf = require('rimraf'),
	request = require('request'),
	xlsx = require('xlsx'),
	Dropbox = require("dropbox"),
	secrets = require('./secrets'),
	config = {
		distDir: './public/dist/',
		albumsDistDir: './public/dist/albums/',
		publicAlbumsDir: './dist/albums/',
		expositionsPath: './public/dist/expositions.xlsx',
	},
	client = new Dropbox.Client({
	    key: "l5inr16mi6dwj2h",
			secret: secrets.dropbox.secret,
			token:  secrets.dropbox.token
	}),
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
	};

app.set('env', process.env.NODE_ENV);
app.set('port', process.env.PORT || 2000);

app.configure(function(){

	app.engine('.hbs', hbs.engine);

  app.set('view engine', '.hbs');

  app.use(express.compress());

	//app.use(express.logger());
	app.use(express.static(path.join(__dirname,'../public')));
	app.use(app.router);

	app.use(function(req, res){
		res.status(404).sendfile('./public/404.html');
	});

	app.use(function(err){
		console.error(err);
		res.status(500).send('An error has occured');
	});
});

// var loadAlbums = function(done, res, next){
// 	client.readdir('/website/albums/', function(error, folders){
// 		if(error) {
// 			next(error);
// 		} else {
// 			async.map(folders, function(album, cb){
// 				client.readdir('/website/albums/'+album, function(error, files){
// 					if(error) return cb(error);
// 					cb(null, {
// 						name: album,
// 						art: _.map(files, function(filename){
// 							var src = '/website/albums/'+album+'/'+filename,
// 								name = path.basename(src, path.extname(src));
// 							return {
// 								name: name,
// 								url: client.thumbnailUrl(src, {size: 'xl'})+"&access_token="+secrets.dropbox.token,
// 								dest: config.albumsDistDir+album+'/'+filename,
// 								thumbURL: client.thumbnailUrl(src, {size: 'l'})+"&access_token="+secrets.dropbox.token,
// 								thumbDest: config.albumsDistDir+album+'/'+name+'.thumbnail'+path.extname(src)
// 							}
// 						})
// 					});
// 				});
// 			}, function(err, albums){
// 				if(err) next(err);
//
// 				//Remove old dist content, create new albums.
// 				async.series([
// 					_.partial(rimraf, config.distDir),
// 					_.partial(fs.mkdir, config.distDir),
// 					_.partial(fs.mkdir, config.albumsDistDir),
// 				].concat(_.map(albums, function(a){
// 					res.write("Creating album "+a.name+"\n");
// 					return _.partial(fs.mkdir, config.albumsDistDir+a.name);
// 				})), function(err){
// 					if(err) return next(err);
//
// 					// Generate the list of the files to download (pic + thumbnail)
//
// 					function download(url, dest, cb){
// 						var file = fs.createWriteStream(dest);
// 						request(url).pipe(file);
// 						file.on('finish', function() {
// 							res.write("Downloaded "+url+" to "+dest+"\n");
// 					    	file.close();
// 					    	cb();
// 					    });
// 					}
//
// 					var dl = _.reduce(albums, function(acc, a){
//
//
// 						var thumbs = _.map(a.art, function(p){
// 							return _.partial(download, p.thumbURL, p.thumbDest);
// 						});
//
// 						var pics = _.map(a.art, function(p){
// 							return _.partial(download, p.url, p.dest);
// 						});
//
// 						return acc.concat(thumbs).concat(pics);
// 					}, []);
//
// 					//Fire in the hole
// 					async.series(dl, function(error){
// 						if(error) return next(error);
//
// 						//Rebuild the albums list
// 						parseAlbums.cache = {};
// 						parseAlbums();
// 						res.end("\n\n\nSuccés! "+dl.length/2 +" images dans "+albums.length+" albums ont étées mises à jour."+"\n");
// 						done();
// 					});
// 				});
// 			});
// 		};
// 	});
// }
//
// var parseAlbums = _.memoize(function(){
//
// 	var as = _(fs.readdirSync(config.albumsDistDir)).filter(function(path){
// 		return fs.statSync(config.albumsDistDir+path).isDirectory();
// 	}).map(function(a) {
// 		return {
// 			name: a,
// 			art: _(fs.readdirSync(config.albumsDistDir+a)).map(function(p){
// 				if(p.indexOf('.thumbnail.')>-1) return;
// 				var name = path.basename(p, path.extname(p));
// 				return {
// 					name: name,
// 					src: config.publicAlbumsDir+a+'/'+p,
// 					thumbnail: config.publicAlbumsDir+a+'/'+name+'.thumbnail'+path.extname(p)
// 				};
// 			}).filter(_.identity).value()
// 		}
//
// 	}).value();
// 	return as;
// });

// var getAlbums = function(){
// 	fs.readdirSync(config.albumsDistDir, function(err, paths){
// 		async.parralel(_.map(paths, function(path){
// 			return _.partial(fs.stat, path),
// 		}), function(err, stats){
// 			_(stats).filter(function(s){
// 				return s.isDirectory();
// 			}).map(function(album){
//
// 			});
// 		});
// 	});
// }

function loadExpos(cb){

	var file = fs.createWriteStream(config.expositionsPath);
	request('https://dl.dropbox.com/s/6xq2iykbsqjf7rn/expositions.xlsx')
		.pipe(file);

	file.on('finish', function(){
		cb();
	});
}

var parseExpos = _.memoize(function(){
	var workbook = xlsx.readFile(config.expositionsPath);
	var data = xlsx.utils.sheet_to_json(workbook.Sheets.Sheet1, {header:1})
	return _.map(_.rest(data), function(row){
		return {
			name: row[0],
			description: row[1],
			featured: row[2].toLowerCase() == 'oui',
			links: {
				maps: row[3],
				facebook: row[4],
				twitter: row[5]
			}
		}
	});
});

app.get('/', function(req, res){

	// var albums = parseAlbums(),
	// var		expos = parseExpos();
	// console.log("Expos:", expos);
	res.render('home', {
		featuredExpos: [_.find(expos, {featured: true})],
		expos: _.filter(expos, {featured: false}),
		albums: _.map(albums, function(a){
			return _.extend(a, {
				items: _.reduce(a.art, function(acc, item, index){
					acc[index%3].push(item);
					return acc;
				}, [[], [], []])
			})
		})
	});
});

app.get('/json', function(req, res){
	res.json(parseAlbums());
});

app.get('/r', function(req, res, next){
	res.set({ 'Content-Type': 'text/plain; charset=utf-8' });
	loadAlbums(function(){}, res, next);
});

app.get('/re', function(req, res){
	loadExpos(function(){
		res.end('expos loaded');
	});
});

//Retrieves and caches the image to file
function lazyFetch(album, image, ext, size, done){
	var src = '/website/albums/'+album+'/'+image+'.'+ext,
	 	 url = client.thumbnailUrl(src, {size: size})+"&access_token="+secrets.dropbox.token,
			dest = config.albumsDistDir+album+'/'+image+'-'+size+'.jpg';

	mkdirp(config.albumsDistDir+album, function(err){
		if(err) {
			console.error("Error creating album:", err);
			return done(err);
		}
		var file = fs.createWriteStream(dest, {flags: 'wx'});
		request(url).pipe(file);

		file.on('finish', function() {
			console.log("Downloaded "+url+" to "+dest+"\n");
			file.close();
			done(null, dest);
		});
		file.on('error', function(e){
				//If file exists, just serve that one
				if (e.code !== 'EEXIST') {
					return done(e);
				} else {
					return done(null, dest);
				}
		});
	});
}

app.get('/dist/albums/:album/:image.:size.:ext', function(req, res, next){
	if(!_.contains(['xl', 'l', 'm', 's', 'x'], req.params.size)){
		console.warn("Invalid thumbnail size received:", req.params.size);
		return res.end("Invalid thumbnail size received:", req.params.size);
	}
	lazyFetch(req.params.album, req.params.image, req.params.ext, req.params.size, function(err, path){
		if(err){
			console.error("Caught error fetching file", err);
			return next(err);
		}
		res.sendfile(path);
	});
});



//Dropbox content loaders.

var getExpos = function(cb){
	var file = fs.createWriteStream(config.expositionsPath);
	request('https://dl.dropbox.com/s/6xq2iykbsqjf7rn/expositions.xlsx')
		.pipe(file);

	file.on('finish', function(){
		var workbook = xlsx.readFile(config.expositionsPath);
		var data = xlsx.utils.sheet_to_json(workbook.Sheets.Sheet1, {header:1});
		var expos = _.map(_.rest(data), function(row){
			return {
				name: row[0],
				description: row[1],
				featured: row[2].toLowerCase() == 'oui',
				links: {
					maps: row[3],
					facebook: row[4],
					twitter: row[5]
				}
			}
		});
		cb(null, expos);
	});
}

var getAlbums = function(done){
	client.readdir('/website/albums/', function(error, folders){
		if(error) return done(error);

		async.map(folders, function(album, cb){
			client.readdir('/website/albums/'+album, function(error, files){
				if(error) return cb(error);
				cb(null, {
					name: album,
					art: _.map(files, function(filename){
						var name = path.basename(filename, path.extname(filename));
						return {
							name: name,
							src: config.publicAlbumsDir+album+'/'+name+'.xl'+path.extname(filename),
							thumbnail: config.publicAlbumsDir+album+'/'+name+'.l'+path.extname(filename)
						};
					})
				});
			});
		}, function(err, albums){
			if(err) return done(err);
			done(null, albums);
		});
	});
}

//Setup the file system, and load the data.
mkdirp.sync(config.albumsDistDir);
var albums, expos;
async.parallel(
	[
		getAlbums,
		getExpos
	], function(err, data){
		if(err) throw err;
		albums = data[0];
		expos = data[1];
		http.createServer(app).listen(app.get('port'), function(){
			console.info("HTTP server listening on port "+app.get('port'));
		});
	}
);

// if(app.get('env') == 'production'){
// 	loadAlbums(function(){
// 		loadExpos(function(){
// 			parseExpos();
// 			start();
// 		})
// 	}, {
// 		write: console.log,
// 		end: console.log,
// 	}, function(err){
// 		console.error("an error has occured:", err);
// 	});
// } else {
// 	//Trigger the memoization from the file system right away.
// 	// parseAlbums();
// 	// parseExpos();
// 	start();
// }
