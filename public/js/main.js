$(function(){
    $('#blueimp-gallery').data('useBootstrapModal', false);
    $('#blueimp-gallery').toggleClass('blueimp-gallery-controls', true);
    $("img").unveil();
    $("#menu").sticky({
      topSpacing:0,
      zIndex:100
    });
    $('input, textarea').placeholder();
});
