function pageLoad()
{
    var preDarkMode = location.search.split('nightMode=')[1];

    var checkbox = document.getElementById('customSwitches');

    checkbox.checked = preDarkMode == 'true';

    darkmode();

}

function darkmode()
{

    var checkbox = document.getElementById('customSwitches');

    var list1 = document.getElementsByClassName('badge');
    if (checkbox.checked == false)
    {
        for(var i = 0; i < list1.length; i++) {
            
            list1[i].classList.remove('badge-dark')
            list1[i].classList.add('badge-light')
        }
        
        document.body.style.backgroundColor = "white";
        document.getElementsByTagName('h1')[0].style.color = "black";
        document.getElementsByTagName('label')[0].style.color = "black";
        document.getElementsByTagName('p')[0].style.color = "black";
        document.getElementsByTagName('p')[1].style.color = "black";
    }
    else 
    {
        for(var i = 0; i < list1.length; i++) {
            
            list1[i].classList.remove('badge-light')
            list1[i].classList.add('badge-dark')
        }
        document.body.style.backgroundColor = '#2a2a2a';
        document.getElementsByTagName('h1')[0].style.color = "white";
        document.getElementsByTagName('label')[0].style.color = "#8a8a8a";
        document.getElementsByTagName('p')[0].style.color = "#cacaca";
        document.getElementsByTagName('p')[1].style.color = "#8a8a8a";
    }
}

function redirectPage (url) {
    window.location = url + '?nightMode=' + document.getElementById('customSwitches').checked;
}
