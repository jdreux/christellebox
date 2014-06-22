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
  });

var config = {
		distDir: './public/dist/',
		albumsDistDir: './public/dist/albums/',
		publicAlbumsDir: './dist/albums/',
		expositionsPath: './public/dist/expositions.xlsx',
	},
	secrets;

//Try to load the secrets module (local env)

try {
	secrets = require('./secrets');
} catch(err){
	//Not available, use params instead
	secrets = {
		dropbox: {
			secret: process.env.DROPBOX_SECRET,
			token: process.env.DROPBOX_TOKEN
		}
	};
}

client = new Dropbox.Client({
		key: "l5inr16mi6dwj2h",
		secret: secrets.dropbox.secret,
		token:  secrets.dropbox.token
}),

app.set('env', process.env.NODE_ENV);
app.set('port', process.env.PORT || 2000);

app.configure(function(){

	app.engine('.hbs', hbs.engine);

  app.set('view engine', '.hbs');

  app.use(express.compress());

	app.use(express.logger());
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

app.get('/', function(req, res){
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

//Setup the file system, and do an initial load of the data
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
