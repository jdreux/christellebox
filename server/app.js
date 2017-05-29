var express = require('express'),
	path = require('path'),
	http = require('http'),
	fs = require('fs'),
	util = require('util'),
	async = require('async'),
	_ = require('lodash'),
	exphbs  = require('express3-handlebars'),
	mkdirp = require('mkdirp'),
	request = require('request'),
	xlsx = require('xlsx'),
	Dropbox = require('dropbox'),
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

const DIST_DIR = './public/dist/',
			IMAGES_PUBLIC_PATH = '/dist/images/',
			THUMBNAILS_PUBLIC_PATH = '/dist/thumbnails/',
 			ARTIST = process.env.ARTIST || 'pa',
			CONFIG = ARTIST === 'pa' ?
			{
				dropboxPath: '/folder-sites/website-pa/albums/',
				home: 'home-pa',
			}
			:
			{
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
	res.render(CONFIG.home, {
		// featuredExpos: [_.find(expos, {featured: true})],
		// expos: _.reject(expos, {featured: true}),
		albums: _.map(app.get('albums'), function(a){
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
	res.end('Reload started. You can navigate back to the homepage now!');
});

//Routes that catches uncached dropbox assets. Downloads them and saves them to the fs.
app.get(IMAGES_PUBLIC_PATH+'*.jpg', function(req, res, next){
	const dbPath = '/'+req.params[0]+'.jpg';
	console.info("Fetching uncached image at:", dbPath);
	fetchImage(dbPath, function(err, localPath){
		if(err){
			console.error("Caught error fetching file", err);
			return next(err);
		}
		res.sendfile(localPath);
	});
});

app.get(THUMBNAILS_PUBLIC_PATH+'*.jpg', function(req, res, next){
	const dbPath = '/'+req.params[0]+'.jpg';
	console.info("Fetching uncached thumbnail at:", dbPath);
	fetchThumbnail(dbPath, function(err, localPath){
		if(err){
			console.error("Caught error fetching file", err);
			return next(err);
		}
		res.sendfile(localPath);
	});
});

function fetchImage(dbPath, callback){
	dbx.filesDownload({path: dbPath}).then(function(data){
		const localPath = path.join(DIST_DIR,'/images/',dbPath);
		mkdirp(path.dirname(localPath), function(err){
			if(err) return callback(err);
			fs.writeFile(
				localPath,
				data.fileBinary,
				'binary',
				function (err) {
		      if(err) return callback(err);
		      console.log('File: ' + localPath + ' saved.');
					callback(null, localPath);
	    });
		});
	}).catch(callback);
}

function fetchThumbnail(dbPath, callback){
	dbx.filesGetThumbnail({path: dbPath, size: 'w640h480'}).then(function(data){
		const localPath = path.join(DIST_DIR,'/thumbnails/',dbPath);
		mkdirp(path.dirname(localPath), function(err){
			if(err) return callback(err);
			fs.writeFile(
				localPath,
				data.fileBinary,
				'binary',
				function (err) {
		      if(err) return callback(err);
		      console.log('File: ' + localPath + ' saved.');
					callback(null, localPath);
	    });
		});
	}).catch(callback);
}

//Setup the file system, and do an initial load of the data
mkdirp.sync(DIST_DIR);

function load(callback){
	dbx.filesListFolder({
		path: CONFIG.dropboxPath,
		include_media_info: true,
	}).then(function(albumFolders){
		async.map(albumFolders.entries, function(album, cb){
			dbx.filesListFolder({
				path: album.path_lower,
				include_media_info: true,
			}).then(function(mediaFiles){
				cb(null, {
					name: path.basename(album.path_display),
					art: _.compact(_.map(mediaFiles.entries, function(file){
						const extension = path.extname(file.path_lower);
						if(extension !== '.jpg'){
							return null;
						}
						return {
							name: path.basename(
								file.name,
								path.extname(file.name)
							),
							src: path.join(IMAGES_PUBLIC_PATH, file.path_lower),
							thumbnail_src: path.join(THUMBNAILS_PUBLIC_PATH, file.path_lower),
							dropbox_path: file.path_lower,
							dimensions: file.media_info.metadata.dimensions
						}
					})),
				});
			}).catch(cb);
		}, function(error, albums){
			if(error){
				console.error("Error fetching albums: ", error, error.stack);
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
	console.info("HTTP server for artist '"+ARTIST+"' listening on port "+app.get('port'));
});

if(app.get('env') !== 'production'){
	rimraf.sync(DIST_DIR);
}

load(function(albums){
	app.set('albums', albums);
	// console.info("Loading done", util.inspect(albums, {showHidden: false, depth: null}));
});

process.on('message', function(message){
  if(message.action == 'reload'){
		console.info("Reload message received (cluster: "+require('cluster').worker.id+")");
		load(function(albums){
			app.set('albums', albums);
			console.info("Loading done");
		});
  }
});
