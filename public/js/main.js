$(function(){
    $('#blueimp-gallery').data('useBootstrapModal', false);
    $('#blueimp-gallery').toggleClass('blueimp-gallery-controls', true);
    $("img").unveil(4000);
    $("#menu").sticky({
      topSpacing:0,
      zIndex:100
    });
    $('input, textarea').placeholder();
});
