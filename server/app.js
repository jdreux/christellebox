var express = require('express'),
	path = require('path'),
	http = require('http'),
	fs = require('fs'),
	async = require('async'),
	_ = require('lodash'),
	exphbs  = require('express3-handlebars'),
	mkdirp = require('mkdirp'),
	request = require('request'),
	xlsx = require('xlsx'),
	Dropbox = require("dropbox"),
	rimraf = require('rimraf'),
	app = express(),
	hbs = exphbs.create({
      extname: '.hbs',
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
  });

const artist = process.env.ARTIST || 'pa',
			config = artist === 'pa' ?
			{
				distDir: './public/dist/',
				albumsDistDir: './public/dist/albums/',
				publicAlbumsDir: './dist/albums/',
				expositionsPath: './public/dist/expositions.xlsx',
				dropboxPath: '/folder-sites/website-pa/albums/',
				home: 'home-pa',
			}
			:
			{
				distDir: './public/dist/',
				albumsDistDir: './public/dist/albums/',
				publicAlbumsDir: './dist/albums/',
				expositionsPath: './public/dist/expositions.xlsx',
				dropboxPath: '/website/albums/',
				home: 'home-chd',
			};

var secrets;
//Try to load the secrets module (local env)
try {
	secrets = require('./secrets');
} catch(err){
	//Not available, use params instead
	if(!process.env.DROPBOX_SECRET || !process.env.DROPBOX_TOKEN) {
		throw "No dropbox tokens defined!";
	}
	secrets = {
		dropbox: {
			secret: process.env.DROPBOX_SECRET,
			token: process.env.DROPBOX_TOKEN,
		}
	};
}

const dbx = new Dropbox({
		// key: "l5inr16mi6dwj2h",
		// secret: secrets.dropbox.secret,
		accessToken:  secrets.dropbox.token
});


app.set('env', process.env.NODE_ENV);
app.set('port', process.env.PORT || 2000);

app.configure(function(){
	app.engine('.hbs', hbs.engine);
  app.set('view engine', '.hbs');

  app.use(express.compress());
	app.use(express.static(path.join(__dirname,'../public')));
	app.use(express.json());
	app.use(express.urlencoded());
	app.use(app.router);

	app.use(function(req, res){
		res.status(404).sendfile('./public/404.html');
	});
	app.use(function(err){
		console.error(err);
		res.status(500).send('An error has occured');
	});
});

app.get('/', function(req, res){
	res.render(config.home, {
		featuredExpos: [_.find(expos, {featured: true})],
		expos: _.reject(expos, {featured: true}),
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

app.get('/admin/reload', function(req, res){
	process.send({action: 'refresh', uid: Math.random()});
	res.end('done ('+require('cluster').worker.id+'). Full reload started.');
});

//Route that catches uncached dropbox assets. Downloads them and saves them to the fs.
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



//Retrieves and caches the image to file
function lazyFetch(album, image, ext, size, done){
	const src = config.dropboxPath+album+'/'+image+'.'+ext,
				url = +"&access_token="+secrets.dropbox.token,
				dest = config.albumsDistDir+album+'/'+image+'-'+size+'.jpg';

	dbx.thumbnailUrl({path: src, size: 'w640h480'}).then(function(){
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
	}, function(err){
		if(err) {
			console.error("Error fetching thumbnail:", err);
			return done(err);
		}
	});
}

// _.map(mediaFiles.entries, function(file){
//
// });

// async.map(mediaFiles.entries, function(file, cb){
// 	console.log(file);
// 	dbx.filesGetThumbnail({
// 		path: file.path_lower,
// 		size: 'w640h480'
// 	}).then(function(thumbnail){
// 		console.log('thumbnail', thumbnail);
// 	})
// });
// async.map(mediaFiles.entries, function(file, cb2){
// 	// console.log(file);
// 	dbx.filesDownload({path: file.path_lower}).then(function(data){
// 		// console.log("Got data", data.name);
// 		fs.writeFile(config.distDir+file.path_lower, data.fileBinary, 'binary', function (err) {
//       cb2(err);
//       console.log('File: ' + file.path_lower + ' saved.');
//     });
// 	});
// });

// mkdirp(config.distDir+album.path_lower, function(err){
// 	if(err) {
// 		console.error("Error creating album:", err);
// 		return done(err);
// 	}
//
// });

//Dropbox content loaders

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
				featured: (row[2] || '').toLowerCase() == 'oui',
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

//Setup the file system, and do an initial load of the data
mkdirp.sync(config.albumsDistDir);
var albums, expos;

// function load(done){
// 	async.parallel(
// 		[
// 			// Get the albums & files content
// 			function(callback){
// 				dbx.filesListFolder({
// 					path: config.dropboxPath,
// 					include_media_info: true,
// 				}).then(function(albumFolders){
// 					async.map(albumFolders.entries, function(album, cb){
// 						dbx.filesListFolder({
// 							path: album.path_lower,
// 							// include_media_info: true,
// 						}).then(function(mediaFiles){
// 							cb({
// 								name: path.basename(album.path_display),
// 							});
// 						}).catch(cb);
// 					}, callback);
// 				}).catch(function(error){
// 					console.error("Error fetching folders: ", error);
// 					callback(error);
// 				});
// 			},
//
// 			// 		if(error) return done(error);
// 			// 		async.map(folders, function(album, cb){
// 			// 			client.readdir(config.dropboxPath+album, function(error, files){
// 			// 				if(error) return cb(error);
// 			// 				cb(null, {
// 			// 					name: album,
// 			// 					art: _.map(files, function(filename){
// 			// 						var name = path.basename(filename, path.extname(filename));
// 			// 						return {
// 			// 							name: name,
// 			// 							src: config.publicAlbumsDir+album+'/'+name+'.xl'+path.extname(filename),
// 			// 							thumbnail: config.publicAlbumsDir+album+'/'+name+'.l'+path.extname(filename)
// 			// 						};
// 			// 					})
// 			// 				});
// 			// 			});
// 			// 		}, function(err, albums){
// 			// 			if(err) return done(err);
// 			// 			done(null, albums);
// 			// 		});
// 			// 	});
// 			// },
// 			// getExpos
// 		], function(err, data){
// 			console.log("parallel cb")
// 			if(err) throw err;
// 			albums = data[0];
// 			expos = data[1];
// 			console.info("Loaded %d albums and %d exhibitions.", albums.length, expos.length);
// 			done();
// 		}
// 	);
// }

function load(callback){
	dbx.filesListFolder({
		path: config.dropboxPath,
		include_media_info: true,
	}).then(function(albumFolders){
		async.map(albumFolders.entries, function(album, cb){
			dbx.filesListFolder({
				path: album.path_lower,
				include_media_info: true,
			}).then(function(mediaFiles){
				cb(null, {
					name: path.basename(album.path_display),
					art: _.map(mediaFiles.entries, function(file){
						console.log(file);
					}),
				});
			}).catch(cb);
		}, function(error, albums){
			if(error){
				console.error("Error fetching albums: ", error);
				throw error;
			}
			console.info("Loaded %d albums.", albums.length);
			callback(albums);
		});
	}).catch(function(error){
		console.error("Error fetching folders: ", error);
		throw error;
	});
}

http.createServer(app).listen(app.get('port'), function(){
	console.info("HTTP server for artist '"+artist+"' listening on port "+app.get('port'));
});

if(app.get('env') !== 'production'){
	rimraf.sync(config.distDir);
}

load(function(albums){
	console.info("Loading done", albums);
});

process.on('message', function(message){
  if(message.action == 'reload'){
		console.info("Reload message received (cluster: "+require('cluster').worker.id+")");
		load(function(){
			console.info("Loading done");
		});
  }
});
