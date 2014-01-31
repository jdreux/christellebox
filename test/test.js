var 
	path = require('path'),
	http = require('http'),
	https = require('https'),
	fs = require('fs'),
	async = require('async'),
	_ = require('lodash'),
	
	rimraf = require('rimraf'),
	request = require('request'),
	Dropbox = require("dropbox"),
	client = new Dropbox.Client({
	    key: "do4maj0zi41t4jb",
	    secret: "6kzlbdpgo6xdmrq",
	    token: "MqSHzISeN_EAAAAAAAAAAdrtC29XoTviCS7QJFWMtU46d49oogHGzA--b-7b9794"
	}),

	data = require('./socatoa_christelledreuxcom.js');


function normalize(str) {

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

rimraf('./created/albums', function(){
	
	fs.mkdirSync('./created/albums');

	_.each(data.albums, function(album){
		fs.mkdirSync('./created/albums/'+normalize(album.ALBUM_NAME));

		var pics = _(data.pictures).filter({'PICTURE_ALBUM_ID': album.ALBUM_ID}).map(function(p){
			return {
				source: './AlbumGallery/'+album.ALBUM_ID+'/full/'+p.PICTURE_ID,
				dest: './created/albums/'+normalize(album.ALBUM_NAME)+'/'+normalize(p.PICTURE_NAME)+'.jpg'
			}
		}).value();

		_.each(pics, function(p){
			console.log(p);
			fs.createReadStream(p.source).pipe(fs.createWriteStream(p.dest));
		});

		console.log(pics);

	});	
});


