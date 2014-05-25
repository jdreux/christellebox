var mysql = require('mysql'),
	Q = require('Q'),
	fs = require('fs'),
	rimraf = require('rimraf'),
	_ = require('lodash'),
	http = require('http'),
	fs = require('fs'),
	async = require('async');

var connection = mysql.createConnection({
  host     : '192.232.216.176',
  port: 3306,
  user     : '',
  password : '',
  database: 'socatoa_christelledreuxcom',
  insecureAuth: true
});

function entityDecode(str) {

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
				.replace(/\//g, " - ")
}

connection.connect();

rimraf.sync('./albums');
fs.mkdirSync('./albums/');

connection.query('SELECT * FROM AG_ALBUMS', function(err, albums) {
  if (err) throw err;
  _.each(albums, function(album){
  	// if(album.ALBUM_ID != '473f50ec84df9') return;
  	console.log(album);  	
  	fs.mkdirSync('./albums/'+entityDecode(album.ALBUM_NAME));
  	connection.query("SELECT * FROM AG_PICTURES WHERE PICTURE_ALBUM_ID  = '"+album.ALBUM_ID+"'",
  		function(err, pictures){
  			if (err) throw err;
  			if(album.ALBUM_ID == '473f50ec84df9'){
  				console.log(pictures);
  			}
  			_.each(pictures, function(picture){
  				var source = './AlbumGallery/'+album.ALBUM_ID+'/full/'+picture.PICTURE_ID,
  					target = "./albums/"+entityDecode(album.ALBUM_NAME)+'/'+entityDecode(picture.PICTURE_NAME)+'.jpg';
  				if(album.ALBUM_ID == '473f50ec84df9'){
  					console.log("Loading "+picture.PICTURE_NAME, source, target);
  				}
  				fs.createReadStream(source)
  					.pipe(fs.createWriteStream(target));
  			});
  		});
  });
});