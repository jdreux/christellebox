$(function(){
  $('input, textarea').placeholder();
  $("#contact").click(function(){
    $('.message-container').toggleClass('expanded')
  });
  $('#send').click(function(e){
    e.preventDefault();
    var $form = $(this).closest('form'),
      email = $form.find('input').val(),
      message = $form.find('textarea').val();


    if(!email){
      return alert("Veuillez fournir une address email de contact. / Please provide a contact email.");
    }

    if(!message){
      return alert("Veuillez compléter le message. / Please provide a message.");
    }

    $.ajax({
        type: "POST",
        url: '/contact',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({ email: email, message: message})
    }).done(function(){
      $('.message-container').toggleClass('expanded');
    }).fail(function(){
      alert("An error has occured");
    });

  });
});
