/*
 *  Translator - v2.0.6
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
			property : null,
			smallTextarea : false,
			imgMode : false
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

				// Hard reset
				this.syncronisedImgs = [];

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
				this.translations = this.settings.translations
				this.populateTranslations();
			} else {
				// Get translation via ajax
				$.ajax({
					url : '//'+$element.data('nls-url')+'/'+$element.data('nls-property'),
					dataType: "json",
					success : function(translations){
						this.translations = translations;
						this.populateTranslations();
					}.bind(this),
					error : function(){
						alert('An error occured when retrieving translations. Please try agin');

						// Enable window
						this.enableWindow();

						this.closeUnderlay();
					}.bind(this)
				});
			}
		},

		populateTranslations : function(){
			// Get locale & property
			var src_locale = this.settings.locale || $(this.element).data('nls-locale') || $(this.element).parents('[data-nls-locale]').data('nls-locale');
			var property = this.settings.property || $(this.element).data('nls-property');

			if (this.settings.imgMode) {
				$('img', this.translationsList).each(function(index, img){
					var locale = img.name.substr(4, 5);

					// Set traduction and id
					if(this.translations && this.translations[locale]) {

						if(this.translations[locale][property] && this.translations[locale][property] != '') {
							img.src = this.translations[locale][property];
						}
						img.id = 'nls-'+this.translations[locale].id;
					} else {
						$(img).addClass('hidden');
					}
				}.bind(this));
			} else {
				// Retrieve textarea and populate them
				$('textarea', this.translationsList).each(function(index, textarea){
					var locale = textarea.name.substr(4, 5);

					// Set traduction and id
					if(this.translations && this.translations[locale]) {
						if(this.translations[locale][property]) {
							textarea.value = this.translations[locale][property];
						}
						if(this.translations[locale].id) {
							textarea.id = 'nls-'+this.translations[locale].id;
						}
					}

					// Populate translation from caller
					if(src_locale == locale && this.element.value) {
						textarea.value = this.element.value;
					}
				}.bind(this));
			};

			// Enable window
			this.enableWindow();
		},

		saveTranslations : function(){
			// Disable window
			this.disableWindow();

			// Create json var and get property
			var $element = $(this.element),
				property = this.settings.property || $element.data('nls-property');

			// Retrieve values and construct json object
			this.sidebarList.children().each(function(index, sidebarItem){

				if($(sidebarItem).hasClass('active')) {
					if (this.settings.imgMode) {
						// Retrieve img
						var img = $('img', $(sidebarItem).data('translation')).get(0);

						// Save only image with a content
						if(img.id || (img.className != 'hidden' && ! img.id)) {
							// Define locale and id
							var id = img.id ? img.id.substr(4) : null,
								locale = img.name.substr(4);

							// Set object values
							this.translations = this.translations || {};
							this.translations[locale] = this.translations[locale] || {};
							this.translations[locale][property] = img.src;
							if(id) this.translations[locale]['id'] = id;
						}
					} else {
						// Retrieve textarea
						var textarea = $('textarea', $(sidebarItem).data('translation'))[0];

						// Define locale and id
						var id = textarea.id ? textarea.id.substr(4) : null,
							locale = textarea.name.substr(4);

						// Save only languages with an actual content
						if(id || (textarea.value !== '' && ! textarea.id)) {
							// Set object values
							this.translations = this.translations || {};
							this.translations[locale] = this.translations[locale] || {};
							this.translations[locale][property] = textarea.value;
							if(id) this.translations[locale]['id'] = id;
						} else if(this.translations && this.translations[locale]) {
							delete this.translations[locale][property];
						}
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
					this.settings.onUpdateSuccess.call(this.element, this.translations);

				// Clear translations
				delete this.translations;
			} else {
				// Send the json object via ajax
				$.ajax({
					type : 'PUT',
					url : '//'+ $element.data('nls-url')+'/'+$element.data('nls-property'),
					dataType: "json",
					data : this.translations,
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

							// Clear translations
							delete this.translations;
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

				if(this.settings.smallTextarea === true) {
					this.translatorWindow.addClass('small-textarea');
				} else {
					this.translatorWindow.removeClass('small-textarea');
				}

				if(this.settings.imgMode === true) {
					this.translatorWindow.addClass('img-mode');
				} else {
					this.translatorWindow.removeClass('img-mode');
				}

				// Attach to underlay
				this.underlay.append(this.translatorWindow);

				// Define interface element vars
				this.sidebarList = $('aside ul', this.translatorWindow);
				this.translationsList = $('.nls-lang-list-slider', this.translatorWindow);
				this.overlay = $('.nls-overlay', this.translatorWindow);
				this.presetsButtonsGroup = $('.btn-group-presets', this.translatorWindow);

				// Set general controls event
				this.setTranslatorWindowEvents();
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

				if (this.settings.imgMode) {
					// Prepare translationItem
					var translationItem = $([
						'<div class="item">',
							'<label>',
								'<span class="legend">',
									language+' ('+locale+')',
								'</span>',
								'<div class="preview">',
									'<img src="#" name="nls-'+locale+'">',
									'<div class="dropzone"></div>',
									'<button class="btn btn-small btn-danger delete"><i class=" icon-remove" /></button>',
								'</div>',
							'</label>',
							'<button class="btn btn-small sync"><i class=" icon-contract" /> Sync</button>',
						'</div>'
					].join(''));
				} else {
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
				}

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

			if (this.settings.imgMode) {
				// Get img
				var img = $('img', translationItem);

				// Skip if already registered
				if( $.inArray(img[0], this.syncronisedImgs) != -1) return;

				// Register
				this.syncronisedImgs.push(img[0]);
			} else {
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
			}
		},

		unregisterForSyncronisation : function(sidebarItem, init){

			// Get translationItem
			var translationItem = sidebarItem.data('translation');

			// Set btn
			$('.sync', translationItem).removeClass('active btn-danger').find('i').removeClass('icon-expand').addClass('icon-contract');

			if (this.settings.imgMode) {
				// Get img
				var img = $('img', translationItem);

				// Remove from array
				var pos = $.inArray(img[0], this.syncronisedImgs);
				if(pos > -1) {
					this.syncronisedImgs.splice(pos, 1);
				}
			} else {
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
			}
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

			// Image events
			if (this.settings.imgMode) {
				// Drop events
				var dropzone = $('.dropzone', translationItem);
				dropzone
					.on('dragenter', function(){
						dropzone.addClass('active');
						return false;
					})
					.on('dragover', function(e){
						dropzone.addClass('active');
						e.preventDefault();
						e.stopPropagation();
						return false;
					})
					.on('dragleave', function(e){
						dropzone.removeClass('active');
						e.preventDefault();
						e.stopPropagation();
						return false;
					})
					.on('drop', function(e){
						dropzone.removeClass('active');

						if (e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.files.length) {
							var file         = e.originalEvent.dataTransfer.files[0];
							var allowedTypes = ['image/jpeg'];
							var img          = $('img', translationItem);

							if ($.inArray(file.type, allowedTypes) > -1) {
								var reader = new FileReader();
								reader.onloadend = function(){
									img.removeClass('hidden').attr('src',reader.result);

									if ($.inArray(img[0], this.syncronisedImgs) > -1) {
										this.syncronisedImgs.forEach(function(entry){
											if (img[0] != entry) {
												$(entry).removeClass('hidden').attr('src',reader.result);
											}
										});
									};
								}.bind(this)
								reader.readAsDataURL(file);
							}
						}

						e.preventDefault();
						e.stopPropagation();
						return false;
					}.bind(this));

				// Delete event
				$('.delete', translationItem).on('click', function(e){
					e.preventDefault();
					$('img', translationItem).addClass('hidden').removeAttr('src');
				})
			}
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
			$(document).on('keyup.Translator', function(e){
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
				if(data && data.enabled) {
					this.enableTranslation(sidebarItem, 'init');
				} else {
					this.disableTranslation(sidebarItem, 'init');
				}

				// Change syncronisation
				if(data && data.syncronised) {
					this.registerForSyncronisation(sidebarItem, 'do not save in localStorage');
				} else {
					this.unregisterForSyncronisation(sidebarItem, 'do not save in localStorage');
				}
			}.bind(this));

			// Reorder items
			$.each(this.userSettings.sets[set_index], function(index, itemSettings){
				var item = $('[data-nls-locale="'+itemSettings.locale+'"]', this.sidebarList).appendTo(this.sidebarList);
				if (item.length) item.data('translation').appendTo(this.translationsList);
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

					// Remove window
					this.translatorWindow.remove();
					delete this.translatorWindow;

					// Remove event
					$(document).off('keyup.Translator');
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
