/*
 *  Translator - v2.0.5
 *  jQuery plugin to provide quick translation interface
 *  http://www.esl.ch
 *
 *
 *  This plugin will autoload on element with both attributes
 *  data-nls-url and data-nls-property. You could provide a
 *  data-nls-locale either on the input calling the plugin or
 *  a parent element (i.e. the form) to set back the new value
 *  in the calling element.
 *  The values sent back to the API are only the visible ones.
 *
 *
 *  Made by ESL Web Team - esl-lpillonel
 *  2013-10-16
 */
;(function ( $, window, document, undefined ) {

	// ECMAScript 5 strict mode
	"use strict";

	// Create the defaults once
	var pluginName = "translator",
		defaults = {
			languages : {
				fr_CH : 'Français – Suisse',
				fr_FR : 'Français - France',
				fr_BE : 'Français - Belgique',
				de_CH : 'Deutsch - Schweiz',
				de_DE : 'Deutsch - Deutschland',
				de_AT : 'Deutsch - Österreich',
				it_CH : 'Italiano - Svizzera',
				it_IT : 'Italiano - Italia',
				en_US : 'English - USA',
				en_GB : 'English - Great Britain',
				es_ES : 'Español - España',
				es_CO : 'Español - Columbia',
				es_PA : 'Español - Panama',
				sv_SE : 'Svenska - Sverige',
				cs_CZ : 'Česky - Česká republika',
				nl_NL : 'Nederlands - Nederland'
			},
			presets : {
				'FR' : ['fr_CH', 'fr_FR', 'fr_BE'],
				'DE' : ['de_CH', 'de_DE', 'de_AT'],
				'IT' : ['it_CH', 'it_IT'],
				'EN' : ['en_US', 'en_GB'],
				'ES' : ['es_ES', 'es_CO', 'es_PA']
			},
			btn_target : '.buttons',
			settings_sets_quantity : 2,
			onOpenTranslationWindow : null,
			onUpdateSuccess : null,
			onUpdateError : null,
			headlessMode : false,
			translations : null,
			locale : null,
			property : null
	};

	// Plugin constructor
	function Translator ( element, options ) {
		// DOM element calling the plugin
		this.element  = element;

		// Plugin settings
		this.settings = $.extend( {}, defaults, options );

		if(this.checkRequire()) {

			// Declare vars
			this.underlay             = null;
			this.overlay			  = null;
			this.translatorWindow     = null;
			this.openButton           = null;
			this.sidebarList          = null;
			this.translationsList     = null;

			this.userSettings         = null;
			this.syncronisedTextareas = [];

			// Initialize Plugin
			this.init();
		}
	}

	// Methods' implementation as prototypes
	Translator.prototype = {

		checkRequire : function(){
			return this.element.getAttribute('data-nls-url') && this.element.getAttribute('data-nls-property') || this.settings.headlessMode ? true : false;
		},

		init: function () {
			// Create button
			this.createOpenButton();

			// Attach events
			this.setBehaviour();
		},

		createOpenButton : function(){
			this.openButton = $('<a class="btn nls-button" title="Translate"><i class="icon-language" /></a>').addClass(this.settings.btn_class);
			if(this.settings.btn_target) {
				$(this.element).next(this.settings.target).prepend(this.openButton);
			} else {
				$(this.element).after(this.openButton);
			}

		},

		setBehaviour : function(){
			this.openButton.bind('click', function(){
				// Underlay
				this.addUnderlay();

				// Create translation window
				this.openTranslationWindow();
			}.bind(this));
		},

		openTranslationWindow : function(){
			// Trigger
			if(typeof this.settings.onOpenTranslationWindow == 'function')
				this.settings.onOpenTranslationWindow.call(this.element, this);

			// Read localStorage config on runtime
			this.readUserSettings();

			// Instantiate window on runtime
			this.attachTranslationWindow();

			// Disable window until ready
			this.disableWindow();

			// Fill window with translations elements
			this.populateTranslationWindow();

			// Load and apply user preferences
			if(typeof this.userSettings.active_set == 'number') {
				this.loadUserSettingsSet(this.userSettings.active_set, 'init');
			} else {
				this.loadPreset(this.userSettings.active_set, 'init');
			}

			// Retrieve translations via API
			this.retrieveTranslations();

			// Set save on button click
			$('.btn-save', this.translatorWindow).bind('click', this.saveTranslations.bind(this));
		},

		retrieveTranslations : function(){
			var $element = $(this.element);

			if (this.settings.headlessMode) {
				this.populateTranslations(this.settings.translations)
			} else {
				// Get translation via ajax
				$.ajax({
					url : '//'+$element.data('nls-url')+'/'+$element.data('nls-property'),
					dataType: "json",
					success : this.populateTranslations.bind(this),
					error : function(){
						alert('An error occured when retrieving translations. Please try agin');

						// Enable window
						this.enableWindow();

						this.closeUnderlay();
					}.bind(this)
				});
			}
		},

		populateTranslations : function(translations){
			if(typeof translations == 'object') {
				// Get this.element text
				var src_locale = this.settings.locale || $(this.element).data('nls-locale') || $(this.element).parents('[data-nls-locale]').data('nls-locale'),
					property = this.settings.property || $(this.element).data('nls-property');

				// Retrieve textarea and populate them
				$('textarea', this.translationsList).each(function(index, textarea){
					var locale = textarea.name.substr(4, 5);

					// Set traduction and id
					if(translations[locale]) {
						if(translations[locale][property]) {
							textarea.value = translations[locale][property];
						}
						textarea.id = 'nls-'+translations[locale].id;
					}

					// Populate translation from caller
					if(src_locale == locale && this.element.value) {
						textarea.value = this.element.value;
					}
				}.bind(this));
			}

			// Enable window
			this.enableWindow();
		},

		saveTranslations : function(){
			// Disable window
			this.disableWindow();

			// Create json var and get property
			var $element = $(this.element),
				property = this.settings.property || $element.data('nls-property'),
				json = {};

			// Retrieve values and construct json object
			this.sidebarList.children().each(function(index, sidebarItem){

				if($(sidebarItem).hasClass('active')) {
					// Retrieve textarea
					var textarea = $('textarea', $(sidebarItem).data('translation'))[0];

					// Save only languages with an actual content
					if(textarea.id || (textarea.value !== '' && ! textarea.id)) {
						// Define locale and id
						var id = textarea.id ? textarea.id.substr(4) : null,
							locale = textarea.name.substr(4);

						// Set object values
						json[locale] = {};
						json[locale][property] = textarea.value;
						if(id) json[locale]['id'] = id;
					}
				}
			}.bind(this));

			if (this.settings.headlessMode) {
				// Get orinial locale
				var locale = this.settings.locale

				// Enable window
				this.enableWindow();

				// Close window
				this.closeUnderlay();

				// Trigger onUpdateSuccess
				if(typeof this.settings.onUpdateSuccess == 'function')
					this.settings.onUpdateSuccess.call(this.element, json);
			} else {
				// Send the json object via ajax
				$.ajax({
					type : 'PUT',
					url : '//'+ $element.data('nls-url')+'/'+$element.data('nls-property'),
					dataType: "json",
					data : json,
					success : function(response){
						if(response.success) {
							// Get orinial locale
							var locale = $(this.element).data('nls-locale') ||
										 $(this.element).parents('[data-nls-locale]').data('nls-locale');

							// Update original input
							locale && this.element && (this.element.value = response.translations[locale] ? response.translations[locale][property] : '');

							// Enable window
							this.enableWindow();

							// Close window
							this.closeUnderlay();

							// Trigger onUpdateSuccess
							if(typeof this.settings.onUpdateSuccess == 'function')
								this.settings.onUpdateSuccess.call(this.element, response);
						} else if(response.error) {
							alert('An error occured when saving translations. Please try agin');

							// Enable window
							this.enableWindow();

							// Trigger onUpdateError
							if(typeof this.settings.onUpdateError == 'function')
								this.settings.onUpdateError.call(this.element, response);
						}
					}.bind(this),
					error : function(){
						alert('An error occured when saving translations. Please try agin');

						// Enable window
						this.enableWindow();
					}.bind(this)
				});
			}
		},

		attachTranslationWindow : function(){
			if( ! this.translatorWindow) {
				// Create translation window or retrieve it if needed
				this.translatorWindow = $('#nls-window-wrapper');
				if( ! this.translatorWindow.length) {
					this.translatorWindow = $([
						'<div id="nls-window-wrapper">',
							'<div class="nls-centerer-cell">',
								'<div id="nls-window">',
									'<div class="nls-container">',
										'<section class="nls-lang-list">',
											'<div class="nls-lang-list-slider" />',
										'</section>',
										'<aside>',
											'<ul />',
										'</aside>',
										'<section class="navbar">',
											'<div class="btn-group btn-group-sets">',
												'<button type="button" class="btn"><i class="icon-cog" /> 1</button>',
												'<button type="button" class="btn"><i class="icon-cog" /> 2</button>',
											'</div>',
											'<div class="btn-group btn-group-presets"></div>',
											'<button class="btn btn-cancel"><i class="icon-cross" /> Cancel</button>',
											'<button class="btn btn-primary btn-save"><i class="icon-checkmark" /> Save</button>',
										'</section>',
										'<div class="nls-overlay" />',
									'</div>',
								'</div>',
							'</div>',
						'</div>'
					].join(''));

					// Attach to underlay
					this.underlay.append(this.translatorWindow);

					// Define interface element vars
					this.sidebarList = $('aside ul', this.translatorWindow);
					this.translationsList = $('.nls-lang-list-slider', this.translatorWindow);
					this.overlay = $('.nls-overlay', this.translatorWindow);
					this.presetsButtonsGroup = $('.btn-group-presets', this.translatorWindow);

					// Set general controls event
					this.setTranslatorWindowEvents();
				} else {
					// Define interface element vars
					this.sidebarList = $('aside ul', this.translatorWindow);
					this.translationsList = $('.nls-lang-list-slider', this.translatorWindow);
					this.overlay = $('.nls-overlay', this.translatorWindow);
					this.presetsButtonsGroup = $('.btn-group-presets', this.translatorWindow);
				}
			}
		},

		populateTranslationWindow : function(){
			// Add each language to translatorWindow
			$.each(this.settings.languages, function(locale, language){
				// Prepare sidebarItem
				var sidebarItem = $([
					'<li data-nls-locale="'+locale+'">',
						'<span class="grab"><i class="icon-reorder" /></span>',
						'<span class="lang">'+language+' ('+locale+')</span>',
						'<span class="visibility"><i class="icon-switch" /></span>',
					'</li>'
				].join(''));

				// Prepare translationItem
				var translationItem = $([
					'<div class="item">',
						'<div class="well">',
							'<label>',
								'<span class="legend">',
									language+' ('+locale+')',
								'</span>',
								'<textarea rows="4" name="nls-'+locale+'"></textarea>',
							'</label>',
							'<button class="btn btn-small sync"><i class=" icon-contract" /> Sync</button>',
						'</div>',
					'</div>'
				].join(''));

				// Attach translation to sidebarItem
				sidebarItem.data('translation', translationItem);

				// Set events
				this.setTranslationEvents(translationItem, sidebarItem);

				// Add elements to windowTranslation
				this.translationsList.append(translationItem);
				this.sidebarList.append(sidebarItem);
			}.bind(this));

			// Add each preset to presets buttons' group
			$.each(this.settings.presets, function(presetName, presetValues){
				var button = $('<div class="btn" data-nls-preset="'+presetName+'">'+presetName+'</div>').bind('click', function(){
					$('.navbar .btn-group .btn', this.translatorWindow).removeClass('active btn-primary');
					button.addClass('active btn-primary');
					this.loadPreset(presetName);
				}.bind(this)).appendTo(this.presetsButtonsGroup);
			}.bind(this));

			// Define active sets' switch
			if(typeof this.userSettings.active_set == 'number') {
				$('.btn-group-sets button:nth-child('+(this.userSettings.active_set+1)+')', this.translatorWindow).addClass('btn-primary active');
			} else if (typeof this.userSettings.active_set == 'string') {
				$('.btn[data-nls-preset="'+this.userSettings.active_set+'"]', this.presetsButtonsGroup).addClass('btn-primary active');
			}
		},

		registerForSyncronisation : function(sidebarItem, init){
			// Get translationItem
			var translationItem = sidebarItem.data('translation');

			// Set btn
			$('.sync', translationItem).addClass('active btn-danger').find('i').removeClass('icon-contract').addClass('icon-expand');

			// Get textarea
			var textarea = $('textarea', translationItem);

			// Skip if already registered
			if( $.inArray(textarea[0], this.syncronisedTextareas) != -1) return;

			// Register
			this.syncronisedTextareas.push(textarea[0]);
			textarea.bind('keyup', function(e){
				this.syncroniseTextareas(e.currentTarget);
			}.bind(this));

			// Save user settings
			if( ! init && typeof this.userSettings.active_set == 'number') this.saveUsersettings(sidebarItem, { syncronised : true });
		},

		unregisterForSyncronisation : function(sidebarItem, init){

			// Get translationItem
			var translationItem = sidebarItem.data('translation');

			// Set btn
			$('.sync', translationItem).removeClass('active btn-danger').find('i').removeClass('icon-expand').addClass('icon-contract');

			// Get textarea
			var textarea = $('textarea', translationItem);

			// Remove event
			textarea.unbind('keyup');

			// Remove from array
			var pos = $.inArray(textarea[0], this.syncronisedTextareas);
			if(pos > -1) {
				this.syncronisedTextareas.splice(pos, 1);
			}

			// Save user settings
			if( ! init && typeof this.userSettings.active_set == 'number') this.saveUsersettings(sidebarItem, { syncronised : false });
		},

		enableTranslation : function(sidebarItem, init) {
			// Prevent item to be enabled twice
			if(sidebarItem.hasClass('active')) return;

			sidebarItem.addClass('active');

			// Show translation
			sidebarItem.data('translation').slideDown();

			// Save user settings
			if( ! init && typeof this.userSettings.active_set == 'number') this.saveUsersettings(sidebarItem, { enabled : true });
		},

		disableTranslation : function(sidebarItem, init){
			// Prevent item to be disabled twice
			if( ! sidebarItem.hasClass('active')) return;

			sidebarItem.removeClass('active');

			// Prevent syncronisation for disabled translation
			this.unregisterForSyncronisation(sidebarItem, 'do not save in localStorage');

			// Hide translation
			sidebarItem.data('translation').slideUp();

			// Save user settings
			if( ! init && typeof this.userSettings.active_set == 'number') this.saveUsersettings(sidebarItem, {
				enabled : false,
				syncronised : false
			});
		},

		syncroniseTextareas : function(textarea){
			$.each(this.syncronisedTextareas, function(i, slaveTextarea){
				if(slaveTextarea != textarea) {
					slaveTextarea.value = textarea.value;
				}
			});
		},

		readUserSettings : function(){
			// Get a translatorUserSettings localStorage
			this.userSettings = localStorage.translatorUserSettings ? JSON.parse(localStorage.translatorUserSettings) : false;

			if( ! this.userSettings) {
				// Generate settings object with settings set
				this.userSettings = {
					active_set : 0,
					sets : []
				};

				// Loop on sets_qty to generate sets
				for (var i = 0; i < this.settings.settings_sets_quantity; i++) {
					this.userSettings.sets[i] = [];
					$.each(this.settings.languages, function(locale, language){
						this.userSettings.sets[i].push({
							locale : locale,
							language : language,
							enabled : true,
							syncronised : false
						});
					}.bind(this));
				}
			}
		},

		saveUsersettings : function(sidebarItem, settings){
			$.extend(this.currentDataForItem(sidebarItem), settings);

			this.saveData();
		},

		saveData : function(){
			// Save settings as json in localStorage
			localStorage.translatorUserSettings = JSON.stringify(this.userSettings);
		},

		saveLanguageOrder : function(){
			// Reconstruct userSettings' set
			var newSettings = [];
			this.sidebarList.children().each(function(index, sidebarItem){
				newSettings.push(this.currentDataForItem(sidebarItem));
			}.bind(this));
			this.userSettings.sets[this.userSettings.active_set] = newSettings;

			this.saveData();
		},

		currentDataForItem : function(sidebarItem){
			// Retrieve language
			var locale = $(sidebarItem).data('nls-locale');
			var data = $.map(this.userSettings.sets[this.userSettings.active_set], function(val, i){
				if(val.locale == locale) return val;
			});

			return data[0];
		},

		setTranslationEvents : function(translationItem, sidebarItem){
			// Add event on toggler
			$('.visibility', sidebarItem).bind('click', function(){
				if(sidebarItem.hasClass('active')) {
					this.disableTranslation(sidebarItem);
				} else {
					this.enableTranslation(sidebarItem);
				}
			}.bind(this));

			// Add event on sync
			var syncButton = $('.sync', translationItem);
			syncButton.bind('click', function(){
				if( ! syncButton.hasClass('active')) {
					// Register textarea for syncronisation
					this.registerForSyncronisation(sidebarItem);

				} else {
					// Register textarea for syncronisation
					this.unregisterForSyncronisation(sidebarItem);
				}
			}.bind(this));
		},

		setTranslatorWindowEvents : function(){
			// Sortable list
			this.sidebarList.sortable({
				containment: '#nls-window aside',
				handle: '.grab',
				//revert: true,
				update : function(event, ui){
					// Get previous element if not first
					if(ui.item.prev().length) {
						ui.item.data('translation').insertAfter(ui.item.prev().data('translation'));
					} else {
						ui.item.data('translation').prependTo(this.translationsList);
					}

					// Save userSettings language order
					if(typeof this.userSettings.active_set == 'number') this.saveLanguageOrder();
				}.bind(this)
			});
			this.sidebarList.disableSelection();

			// Languages Set switch
			var switches = $('.btn-group-sets button', this.translatorWindow).each(function(index, button){
				button = $(button);
				button.bind('click', function(){
					// Load set
					this.loadUserSettingsSet(index);

					// Set interface
					$('.navbar .btn-group .btn', this.translatorWindow).removeClass('active btn-primary');
					button.addClass('active btn-primary');
				}.bind(this));
			}.bind(this));

			// Close button
			$('.btn-cancel', this.translatorWindow).bind('click', this.closeUnderlay.bind(this));

			// Escape key
			$(document).bind('keyup.Translator', function(e){
				if(e.keyCode == 27) this.closeUnderlay();
			}.bind(this));
		},

		loadUserSettingsSet : function(set_index, init){
			// Prevent applying current settings again
			if( ! init && this.userSettings.active_set === set_index) return;

			// Reset syncronisedTextareas
			this.syncronisedTextareas = [];

			// Set new set
			this.userSettings.active_set = set_index;

			// Set items settings accordingly to new set
			this.sidebarList.children().each(function(i, sidebarItem){
				sidebarItem = $(sidebarItem);
				var data = this.currentDataForItem(sidebarItem);

				// Change visibility
				if(data.enabled) {
					this.enableTranslation(sidebarItem, 'init');
				} else {
					this.disableTranslation(sidebarItem, 'init');
				}

				// Change syncronisation
				if(data.syncronised) {
					this.registerForSyncronisation(sidebarItem, 'do not save in localStorage');
				} else {
					this.unregisterForSyncronisation(sidebarItem, 'do not save in localStorage');
				}
			}.bind(this));

			// Reorder items
			$.each(this.userSettings.sets[set_index], function(index, itemSettings){
				var item = $('[data-nls-locale="'+itemSettings.locale+'"]', this.sidebarList).appendTo(this.sidebarList);
				item.data('translation').appendTo(this.translationsList);
			}.bind(this));

			// Save settings as json in localStorage
			if( ! init) this.saveData();
		},

		loadPreset : function(presetName, init){
			// Reset syncronisedTextareas
			this.syncronisedTextareas = [];

			// Set new set
			this.userSettings.active_set = presetName;

			// Get preset values
			var presetValues = this.settings.presets[presetName];

			// Set items settings accordingly to new set
			this.sidebarList.children().each(function(i, sidebarItem){

				sidebarItem = $(sidebarItem);

				// Change visibility
				if($.inArray(sidebarItem.data('nls-locale'), presetValues) >= 0) {
					this.enableTranslation(sidebarItem, 'init');
					this.registerForSyncronisation(sidebarItem, 'do not save in localStorage');
				} else {
					this.disableTranslation(sidebarItem, 'init');
					this.unregisterForSyncronisation(sidebarItem, 'do not save in localStorage');
				}
			}.bind(this));

			// Reorder items
			$.each(presetValues.slice(0).reverse(), function(index, locale){
				var item = $('[data-nls-locale="'+locale+'"]', this.sidebarList).prependTo(this.sidebarList);
				item.data('translation').prependTo(this.translationsList);
			}.bind(this));

			// Save settings as json in localStorage
			if( ! init) this.saveData();
		},

		disableWindow : function(){
			this.overlay.addClass('active');
		},

		enableWindow : function(){
			this.overlay.removeClass('active');
		},

		addUnderlay : function(){
			if( ! this.underlay) {
				this.underlay = $('#nls-underlay');
				if( ! this.underlay.length) {
					this.underlay = $('<div id="nls-underlay" />');
					$(document.body).append(this.underlay);
				}
			}
			this.underlay.show();
			setTimeout(function(){
				this.underlay.addClass('visible');
			}.bind(this), 0);
		},

		closeUnderlay : function(){
			if(this.underlay) {
				this.underlay.removeClass('visible');
				setTimeout(function(){
					// Hide window
					this.underlay.hide();

					// Empty both list
					this.sidebarList.empty();
					this.translationsList.empty();
					this.presetsButtonsGroup.empty();

					// Unbind click on save
					$('.btn-save', this.translatorWindow).unbind('click');
				}.bind(this), 500);
			}
		}
	};

	// A really lightweight plugin wrapper around the constructor,
	// preventing against multiple instantiations
	$.fn[ pluginName ] = function ( options ) {
		return this.each(function() {
			if ( !$.data( this, "plugin_" + pluginName ) ) {
				$.data( this, "plugin_" + pluginName, new Translator( this, options ) );
			}
		});
	};
})(jQuery, window, document);
