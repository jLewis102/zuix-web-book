// Store a global reference to elements of site structure
var pageContainer = zuix.field('content-pages');
var headerElement = zuix.$.find('header');
// The following two elements are available only after the
// layout file of the header has been included so, we wait
// for header content to be loaded before assigning these.
var headerTitle;
var menuButton;
headerElement.on('component:ready', function() {
    headerTitle = zuix.field('header-title');
    menuButton = zuix.field('menu-button').on('click', function () {
        contentNavigator.toggle();
    });
});
// The above event listener is same as `zuix.context(headerElement, function(ctx){..})`

var contentNavigator = null;
var contentLoader = null;
var currentPage = null;

var contentOptions = {
    markdown: {
        css: false,
        markdown: true,
        braces: true
    },
    braces: {
        css: false,
        braces: true
    },
    bracesVars: {
        braces: true
    },
    sidePanel: {
        // configuration
        config: {
            sideMenuElement: 'side-menu',
            autoHideWidth: 960
        },
        // event listeners
        on: {
            'menu_open': sideMenuOpen,
            'menu_close': sideMenuClose,
            'auto_hide': function (e, autoHide) {
                if (autoHide) {
                    pageContainer
                        .removeClass('main-side-menu main-side-menu-pull')
                        .addClass('main-side-menu-off');
                    headerTitle.css('margin-left', '0');
                    menuButton.show();
                } else {
                    pageContainer
                        .removeClass('main-side-menu-off main-side-menu')
                        .addClass('main-side-menu-pull');
                    headerTitle.css('margin-left', '250px');
                    menuButton.hide();
                }
            }
        },
        ready: function (ctx) {
            // store a global reference to the side-menu navigator component
            contentNavigator = ctx;
        }
    },
    contentLoader: {
        on: {
            'path_change': showPage,
            'page_scroll': function (e, data) {
                if (pageContainer.hasClass('main-side-menu-off')) {
                    if (data.event === 'moving' || data.event === 'hitTop' || data.event === 'hitBottom') {
                        if (data.delta < 0) {
                            zuix.$.find('header').removeClass('header-collapse').addClass('header-expand');
                        } else {
                            zuix.$.find('header').removeClass('header-expand').addClass('header-collapse');
                        }
                    }
                }
            }
        },
        ready: function (ctx) {
            contentLoader = ctx;
            contentLoader.data(contentTree);
            var showDelay = 0;
            contentLoader.list(
                // the list items to load
                contentTree.main,
                // the container where to append items
                zuix.field('menu'),
                // the callback function to call once each item is loaded
                function(c, eol) {
                    // animate menu item once its loaded
                    zuix.$(c.view())
                        .animateCss('bounceInLeft', { delay: showDelay+'s' });
                    showDelay += 0.1;
                    // load page content once menu has completed loading
                    if (eol) showPage(contentLoader.path());
                });
        }
    }
};


// Load AnimateCSS extension

zuix.$.ZxQuery.prototype.animateCss  = function (animationName, param1, param2){}; // // forward declaration (kind of)
zuix.using('component', 'https://genielabs.github.io/zuix/ui/utils/animate_css', function(res, ctx) {
    console.log("AnimateCSS extension loaded.", res, ctx);
});


// Add hooks for custom content processing

zuix.hook('html:parse', function (data) {

    // ShowDown - Markdown compiler
    if (this.options().markdown === true && typeof showdown !== 'undefined') {
        data.content = new showdown.Converter()
            .makeHtml(data.content);
    }
    if (this.options().wrapContent === true) {
        data.content = '<div class="page content-padding mdl-shadow--2dp" self="size-xlarge">'+data.content+'</div>';
    }
    if (this.options().braces != null) {
        var _vars = this.options().braces;
        var parsedHtml = zuix.$.replaceBraces(data.content, function (varName) {
            switch (varName) {
                case 'app.title':
                    return CONST_SITE_TITLE;
                case 'site.baseurl':
                    return CONST_BASE_URL;
                default:
                    if (_vars[varName])
                        return _vars[varName];
            }
        });
        if (parsedHtml != null)
            data.content = parsedHtml;
    }

}).hook('view:process', function (view) {

    // Prism code syntax highlighter
    if (this.options().prism && typeof Prism !== 'undefined') {
        view.find('code').each(function (i, block) {
            this.addClass('language-javascript');
            Prism.highlightElement(block);
        });
    }

    // Force opening of all non-local links in a new window
    zuix.$('a[href*="://"]:not([target])').attr('target','_blank');

    // Material Design Light integration - DOM upgrade
    if (/*this.options().mdl &&*/ typeof componentHandler !== 'undefined')
        componentHandler.upgradeElements(view.get());

    //zuix.componentize(view);

}).hook('component:ready', function (ctx) {

    console.log("Component loaded", ctx);

});


// Other utility methods


function sideMenuOpen(e, status) {
    if (status.smallScreen) {
        pageContainer.addClass('main-side-menu-pull');
        headerTitle.parent().addClass('main-side-menu-off main-side-menu-pull');
    }
    menuButton.animateCss('rotateOut', { duration: '0.25s' }, function () {
        this.find('i').html('arrow_back').animateCss('rotateIn', { duration: '0.25s' });
    });
}
function sideMenuClose(e, status) {
    if (status.smallScreen) {
        pageContainer.removeClass('main-side-menu-pull');
        headerTitle.parent().removeClass('main-side-menu-pull');
    }
    menuButton.animateCss('rotateOut', { duration: '0.25s' }, function () {
        this.find('i').html('menu').animateCss('rotateIn', { duration: '0.25s' });
    });
}

function showPage(e, path) {
    // parse path or use default
    if (path == null || path.length === 0)
        path = CONST_STARTPAGE;
    if (path.lastIndexOf('?') > 0) {
        // TODO: should parse query string, not used in this version though
        path = path.substring(0, path.lastIndexOf('?'));
    }
    path = path.replace('#/', '').split('/');
    // get item data
    var item = getItemFromPath(path);
    if (item == null) {
        alert('Error parsing path.');
        return;
    }
    // get and show the page
    contentLoader.getContent(item.data.file, function(pageContext, isNew){
        if (isNew) {
            makeScrollable(pageContext.view());
            pageContainer.append(pageContext.view());
            zuix.componentize(pageContext.view());
        }
        revealPage(pageContext);
    });
    // update the title bar and highlight current menu item
    zuix.$('.side-menu div > a').removeClass('current');
    zuix.$.each(path, function (k, v) {
        zuix.$('.side-menu div[data-id="' + v + '"] > a').addClass('current');
    });
    zuix.field('header-title').html(item.data.title);
}

function revealPage(pageContext) {
    var crossFadeDuration = '0.05s';
    if (currentPage != null)
        zuix.$(currentPage.view()).animateCss('fadeOut', function () {
            this.hide();
        }, { duration: crossFadeDuration });
    zuix.$(pageContext.view()).show().animateCss('fadeIn', null, { duration: crossFadeDuration });
    currentPage = pageContext;
}

function makeScrollable(div) {
    // turn content into an absolute positioned and scrollable element
    // so each page has its own independent scroll
    div.style.position = 'absolute';
    div.style.left = 0;
    div.style.right = 0;
    div.style.bottom = 0;
    div.style.top = 0;
    div.style['overflow'] = 'hidden';
    div.style['overflow-y'] = 'auto';
    div.setAttribute('layout', 'column top-center');
}

function getItemFromPath(path) {
    var item = null, list = contentTree.main;
    for(var p = 0; p < path.length; p++) {
        zuix.$.each(list, function (k, v) {
            if (v.id === path[p]) {
                item = v;
                list = item.list;
                return true;
            }
        });
    }
    return item;
}
