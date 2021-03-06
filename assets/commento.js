(function(global, document) {
    'use strict';

    function $(id) {
        return document.getElementById(id);
    }

    function append(root, el) {
        root.appendChild(el);
    }

    function addClass(el, cls) {
        el.classList.add(cls);
    }

    function removeClass(el, cls) {
        el.classList.remove(cls);
    }

    function create(el) {
        return document.createElement(el);
    }

    function serialize(obj) {
        var str = [];
        for(var p in obj) {
            if (obj.hasOwnProperty(p)) {
                str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
            }
        }

        return str.join("&");
    }

    function setAttr(node, attr, value) {
        node.setAttribute(attr, value);
    }

    function post(url, data, callback) {
        var xmlDoc = new XMLHttpRequest();
        xmlDoc.open('POST', url, true);
        xmlDoc.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xmlDoc.onreadystatechange = function() {
            if (xmlDoc.readyState === 4 && xmlDoc.status === 200) {
                callback(xmlDoc);
            }
        };
        xmlDoc.send(serialize(data));
    }

    function loadJS(file, ready) {
        var script = document.createElement("script");
        var loaded = false;

        script.type = "application/javascript";
        script.src = file;
        script.async = true;
        script.onreadystatechange = script.onload = function() {
            if(!loaded &&
                (!this.readyState ||
                    this.readyState === "loaded" ||
                    this.readyState === "complete"))
            {
                ready();
            }

            loaded = true;
            script.onload = script.onreadystatechange = null;
        };

        append(document.body, script);
    }

    function loadCSS(file) {
        var link = document.createElement("link");
        var head = document.getElementsByTagName('head')[0];

        link.type = "text/css";
        link.setAttribute("href", file);
        link.setAttribute("rel", "stylesheet");

        append(head, link);
    }

    function timeDifference(current, previous) { // thanks stackoverflow
        var msPerMinute = 60000;
        var msPerHour = 3600000;
        var msPerDay = 86400000;
        var msPerMonth = 2592000000;
        var msPerYear = 946080000000;

        var elapsed = current - previous;

        if (elapsed < msPerMinute) {
            return Math.round(elapsed/1000) + ' seconds ago';
        }
        else if (elapsed < msPerHour) {
            return Math.round(elapsed/msPerMinute) + ' minutes ago';
        }
        else if (elapsed < msPerDay ) {
            return Math.round(elapsed/msPerHour ) + ' hours ago';
        }
        else if (elapsed < msPerMonth) {
            return 'approximately ' + Math.round(elapsed/msPerDay) + ' days ago';
        }
        else if (elapsed < msPerYear) {
            return 'approximately ' + Math.round(elapsed/msPerMonth) + ' months ago';
        }
        else {
            return 'approximately ' + Math.round(elapsed/msPerYear ) + ' years ago';
        }
    }

    var _showdownUrl = "/assets/showdown.min.js";
    var _spectreUrl = "/assets/spectre.min.css";
    var _commentoCssUrl = "/assets/commento.min.css";
    var _serverUrl = '';
    var _honeypot = false;
    var API = {};

    var _showdownConverter;

    //Initialise commento in case is not initialised yet
    var Commento = global.Commento || {};

    Commento.version = '0.2.0';

    var _getComments = function() {
        var data = {
            "url": document.location
        };
        post(API.get, data, function(reply) {
            _redraw(JSON.parse(reply.response).comments);
        });
    };

    var _makeCards = function(parentMap, cur) {
        var currentParent = parentMap[cur];
        if(!currentParent || !currentParent.length) {
            return null;
        }

        var cards = create("div");
        currentParent.forEach(function(comment) {
            var card = create("div");
            var title = create("div");
            var h5 = create("h5");
            var subtitle = create("div");
            var body = create("div");
            var footer = create("div");
            var button = create("button");
            var children = _makeCards(parentMap, comment.id);

            addClass(card, "card");

            addClass(title, "card-header");

            h5.innerHTML = comment.name;

            subtitle.innerHTML = timeDifference(Date.now(), Date.parse(comment.timestamp));
            addClass(subtitle, "card-subtitle");
            setAttr(subtitle, "style", "margin-left: 15px;");

            body.id = "body_" + comment.id;
            body.innerHTML = _showdownConverter.makeHtml(comment.comment);

            addClass(body, "card-body");
            addClass(footer, "card-header");

            button.id = "reply_button_" + comment.id;
            button.innerHTML = "Reply";
            addClass(button, "btn");
            setAttr(button, "onclick", "Commento.showReply(" + comment.id + ")");

            footer.appendChild(button);
            title.appendChild(h5);
            title.appendChild(subtitle);
            card.appendChild(title);
            card.appendChild(body);
            card.appendChild(footer);
            if(children) {
                children.classList.add("card-body");
                card.appendChild(children);
            }
            cards.appendChild(card);
        });

        return cards;
    };

    var _redraw = function(comments) {
        var $coms = $("coms");
        var parentMap = {};
        var parent;

        $coms.innerHTML = "";

        comments.forEach(function(comment) {
            parent = comment.parent;
            if(!(parent in parentMap)) {
                parentMap[parent] = [];
            }
            parentMap[parent].push(comment);
        });

        var cards = _makeCards(parentMap, -1);
        if(cards) {
            append($coms, cards);
        }
    };

    Commento.postRoot = function() {
        var $rootComment = $("root_comment");
        var $rootName = $("root_name");
        var rootCommentValue = $rootComment.value;
        var rootNameValue = $rootName.value;
        var data;

        removeClass($rootComment, "is-error");
        removeClass($rootName, "is-error");

        if(!rootCommentValue || !rootCommentValue.length) {
            addClass($rootComment, "is-error");
            return;
        }

        if(!rootNameValue || !rootNameValue.length) {
            addClass($rootName, "is-error");
            return;
        }

        data = {
            url: document.location,
            comment: $rootComment.value,
            name: $rootName.value,
            parent: -1
        };

        if(_honeypot)
            data.gotcha = $("root_gotcha").value;

        post(API.create, data, function() {
            $rootComment.value = "";
            _getComments();
        });
    };

    Commento.submitReply = function(id) {
        var $replyTextArea = $("reply_textarea_" + id);
        var $nameInput = $("name_input_" + id);
        var textAreaValue = $replyTextArea.value;
        var nameInputValue = $nameInput.value;

        removeClass($replyTextArea, "is-error");
        removeClass($nameInput, "is-error");

        if(!textAreaValue || !textAreaValue.length) {
            addClass($replyTextArea, "is-error");
            return;
        }
        if(!nameInputValue || !nameInputValue.length) {
            $nameInput.classList.add("is-error");
            return;
        }

        var data = {
            comment: textAreaValue,
            name: nameInputValue,
            parent: id,
            url: document.location
        };

        if(_honeypot)
            data.gotcha = $("gotcha_" + id).value;

        post(API.create, data, _getComments);
    };

    Commento.cancelReply = function(id) {
        $("reply_textarea_" + id).remove();
        $("submit_button_" + id).remove();
        $("cancel_button_" + id).remove();
        $("name_input_" + id).remove();
        $("reply_button_" + id).setAttribute("style", "display: initial");
    };

    Commento.showReply = function(id) {
        setAttr($("reply_button_" + id), "style", "display: none");

        var $body = $("body_" + id);
        var textArea = create("textarea");
        var name = create("input");
        var honeypot = create("input");
        var cancel = create("button");
        var submit = create("button");
        var buttonHolder = create("div");

        textArea.id = "reply_textarea_" + id;
        addClass(textArea, "form-input");
        append($body, textArea);

        addClass(name, "form-input");
        name.id = "name_input_" + id;
        setAttr(name, "placeholder", "Name");
        setAttr(name, "style", "margin: 1px; width: 33%;");

        addClass(honeypot, "hidden");
        honeypot.id = "gotcha_" + id;

        cancel.id = "cancel_button_" + id;
        cancel.innerHTML = "Cancel";
        addClass(cancel, "btn");
        setAttr(cancel, "onclick", "Commento.cancelReply(" + id + ")");
        setAttr(cancel, "style", "margin: 1px; width: 33%;");

        submit.id = "submit_button_" + id;
        submit.innerHTML = "Reply";
        addClass(submit, "btn");
        addClass(submit, "btn-primary");
        setAttr(submit, "onclick", "Commento.submitReply(" + id + ")");
        setAttr(submit, "style", "margin: 1px; width: 33%;");

        addClass(buttonHolder, "button-holder");
        append(buttonHolder, name);
        if(_honeypot) {
            append(buttonHolder, honeypot);
        }
        append(buttonHolder, cancel);
        append(buttonHolder, submit);
        setAttr(buttonHolder, "style", "display: flex; width: 100%; margin: 2px;");

        append($body, buttonHolder);
    };

    Commento.init = function(configuration) {
        _serverUrl = configuration.serverUrl || _serverUrl;
        _honeypot = configuration.honeypot || _honeypot;
        _showdownUrl = configuration.showdownUrl || (_serverUrl + _showdownUrl);
        _spectreUrl = configuration.spectreUrl || (_serverUrl + _spectreUrl);
        _commentoCssUrl = _serverUrl + _commentoCssUrl;

        API.get = _serverUrl + '/get';
        API.create = _serverUrl + '/create';

        loadCSS(_spectreUrl);
        loadCSS(_commentoCssUrl);

        loadJS(_showdownUrl, function() {
            _showdownConverter = new showdown.Converter();

            var commento = $("commento");
            var div = create("div");
            var textarea = create("textarea");
            var subArea  = create("div");
            var input = create("input");
            var button = create("button");
            var honeypot = create("input");
            var commentEl = create("div");

            addClass(div, "commento-comments");

            textarea.setAttribute("id", "root_comment");
            addClass(textarea, "form-input");

            addClass(subArea, "submit_area");

            addClass(input, "form-input");
            addClass(input, "root-elem");
            input.id = "root_name";
            input.setAttribute("placeholder", "Name");

            button.innerHTML = "Post comment";
            addClass(button, "root-elem");
            addClass(button, "btn");
            addClass(button, "btn-primary");
            button.setAttribute("onclick", "Commento.postRoot()");

            commentEl.id = "coms";

            addClass(honeypot, "hidden");
            honeypot.id = "root_gotcha";

            append(subArea, input);
            append(subArea, button);
            if(_honeypot)
                append(subArea, honeypot);
            append(div, textarea);
            append(div, subArea);
            append(div, commentEl);
            append(commento, div);

            _getComments();
        });
    };

    global.Commento = Commento;

}(window, document));
