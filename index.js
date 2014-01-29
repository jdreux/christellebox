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
	};



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

var parseAlbums = _.memoize(function(){

	return _.map(fs.readdirSync('./public/dist/'), function(a) {

		return {
			name: a,
			art: _.map(fs.readdirSync('./public/dist/'+a), function(p){
				if(p.indexOf('.thumbnail.')>-1) return;
				var name = path.basename(p, path.extname(p));
				return {	
					name: name,
					src: '/dist/'+a+'/'+p,
					thumbnail: '/dist/'+a+'/'+name+'.thumbnail'+path.extname(p)
				};
			})
		}

	});

	return ;
});

//Trigger the memoization from the file system right away.
parseAlbums();

app.get('/', function(){

});

app.get('/json', function(req, res){
	res.json(parseAlbums());
});

app.get('/r', function(req, res, next){
	res.set({ 'Content-Type': 'text/plain; charset=utf-8' });
	client.readdir('/website/albums/', function(error, folders){
		if(error) {
			next(error);
		} else {
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
								url: client.thumbnailUrl(src, {size: 'xl'})+"&access_token=MqSHzISeN_EAAAAAAAAAAdrtC29XoTviCS7QJFWMtU46d49oogHGzA--b-7b9794",
								dest: './public/dist/'+album+'/'+filename,
								thumbURL: client.thumbnailUrl(src, {size: 'l'})+"&access_token=MqSHzISeN_EAAAAAAAAAAdrtC29XoTviCS7QJFWMtU46d49oogHGzA--b-7b9794",
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
					res.write("Creating album "+a.name+"\n");
					return _.partial(fs.mkdir, './public/dist/'+a.name);
				})), function(err){
					if(err) return next(err);

					// Generate the list of the files to download (pic + thumbnail)

					function download(url, dest, cb){
						var file = fs.createWriteStream(dest);
						request(url).pipe(file);
						file.on('finish', function() {
							res.write("Downloaded "+url+" to "+dest+"\n");
					    	file.close();
					    	cb();
					    });
					}

					var dl = _.reduce(albums, function(acc, a){
						

						var thumbs = _.map(a.art, function(p){
							return _.partial(download, p.thumbURL, p.thumbDest);
						});

						var pics = _.map(a.art, function(p){
							return _.partial(download, p.url, p.dest);
						});

						return acc.concat(thumbs).concat(pics);
					}, []);

					//Fire in the hole
					async.series(dl, function(error){
						if(error) return next(error);

						//Rebuild the albums list
						parseAlbums.cache = {};
						parseAlbums();
						res.end("\n\n\nSuccés! "+dl.length/2 +" images dans "+albums.length+" albums ont étées mises à jour."+"\n");
					});
				});
			});
		};
	});	
});

http.createServer(app).listen(2000, function(){
	console.log("HTTP server listening on port 2000");
});