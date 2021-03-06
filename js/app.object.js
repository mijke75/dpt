import { Stages } from './stages.object.js';
import { Phases } from './phases.object.js';
import * as options from './options.js';
import { DbLocalStorage } from './db.localstorage.js';
import { DbOnlineStorage } from './db.onlinestorage.js';

export class App {
    constructor(methodologyId, smallDevice) {
        const self = this;

        this.root = this;
        this.smallDevice = smallDevice;
        this.options = options.default;
        
        // Version number which will be exported when design is saved
        this.version = '0.11.03';
        $(this.options.versionElement).html('v.' + this.version);
        $(this.options.versionAbout).html('version ' + this.version);

        this.methodology;
        this.setDb();
        this.db.initMethodology(methodologyId);

        $.getJSON ('../data/methodology.json', function(result) {
            $.each ( result.methodologies, function( index, obj ) {
                if(obj.id == methodologyId) {
                    self.methodology = obj;
                }
            });

            // Check if we found the methodology otherwise we have to abort
            if(typeof self.methodology == 'undefined') {
                $.toast({
                    type: 'warning', 
                    position: 'center',
                    autoDismiss: true,
                    hideClose: true,
                    message: "Sorry we don't have that methodology available yet."
                });
                setTimeout(function() {
                    window.location.href = '/';
                }, 5500);
            }
            else {
                self.initScreen();
            }
        });

        this.stages = new Stages(this);
        this.phases = new Phases(this);
        this.fabIcon = $(this.options.fabIconToggle);
        this.menu = $(this.options.menuToggle);
        this.aboutElement = $(this.options.aboutModal);
        this.modalOverlayElement = $(this.options.aboutModal + ' ' + this.options.modalOverlay);
        this.modalCloseElement = $(this.options.modalClose);
        this.dotframework = {};

        // Load dotframework JSON with research strategies and methods (to be used in Modal)
        $.getJSON ('../data/dotframework.json', function(dotframework) {
            self.dotframework = dotframework;
        });
    }

    initScreen() {
        const self = this;
        // Set the id into the body, so that the correct CSS is loaded
        $('body').attr('id', this.methodology.id);

        // Update menu item and About information
        $('#menuitem-about-methodology').html('About ' + this.methodology.name);
        $('#about-methodology-title').html(this.methodology.name);
        $('#about-methodology-text').html('<h4>About ' + this.methodology.name + '</h4>' + this.methodology.about);

        $('#fabLoadDP').attr('accept',this.methodology.extension);

        // Render legenda
        let legendaElement = '';
        for(let i = 0; i < this.methodology.legenda.length; i++) {
            legendaElement += '<span>' + this.methodology.legenda[i] + '</span>';
        }
        $(legendaElement).prependTo($(this.options.legenda));


        // Load stages and make it render to the screen
        this.stages.loadStages(this.methodology.stages);
        $.each ( this.stages.list, function( index, stages ) {
            stages.render();
        });
        
        // Load phases and make it render to the screen
        this.phases.loadPhases(this.methodology.phases);
        $.each ( this.phases.list, function( index, phase ) {
            phase.render();
            phase.itemList.loadItems(phase.id);
        });
    }

    closeFabIcon() {
        this.fabIcon.prop( "checked", false );
    }

    closeMenu() {
        this.menu.prop( "checked", false );
    }

    clearStorage() {
        const self = this;
        $.toast({
            type: 'confirm', 
            position: 'center',
            message: 'Are you sure want to delete your design?',
            cancel: 'no',
            submit: 'yes'
        }).done(
            function() { 
                self.#clear();
            }
        );
    }

    // Private function to clear the design
    #clear() {
        this.db.deleteMethodology(this.methodology.id);
        $(this.options.itemElements).remove();
        $(this.options.itemCounter).attr('value', 0);
        $(this.options.itemCounter).html(0);
        this.closeFabIcon();
    }

    saveDesignProcess() {
        if (this.db.isMethodologyEmpty(this.methodology.id)) {
            $.toast({
                type: 'warning', 
                position: 'center',
                autoDismiss: true,
                hideClose: true,
                message: 'Nothing created yet, please make a design first.'
            });
        }
        else {
            // Save the version number and valid is true to check with import
            let items = this.db.loadItems(this.methodology.id);
            let text = '{ "valid": "true", "version": "' + this.version + '", "methodology": "' + this.methodology.id + '", "items": ' + JSON.stringify(items) + ' }';
            let filename = 'export-' + this.#today() + '.' + this.methodology.id;
            this.#download(filename, text, this.options.fabSaveElement);
        }    
        this.closeFabIcon();
    }

    #today = function() {
        let d = new Date(),
        minute = '' + d.getMinutes(),
        hour = '' + d.getHours(),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear(),
        returnValue = '';
    
        if (minute.length < 2) 
            minute = '0' + minute;
        if (hour.length < 2) 
            hour = '0' + hour;
        if (month.length < 2) 
            month = '0' + month;
        if (day.length < 2) 
            day = '0' + day;
    
        returnValue = [year, month, day].join('-') + '-' + [hour, minute].join('.');
        return returnValue;
    }

    // Attach the created file to the hidden download and trigger this to download the file 
    #download = function(filename, text, el) {
        let element = document.getElementById(el);
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
    
        element.click();
    }

    loadDesignProcess() {
        const self = this;
        let allowed = false;
        // Check if we have an empty design
        if (this.db.isMethodologyEmpty(this.methodology.id)) {
                this.#load();
        }
        else {
            // Check if the user wants to overwrite the current design
            $.toast({
                type: 'confirm', 
                position: 'center',
                message: 'Are you sure you want to import a design and loose your current work?',
                cancel: 'no',
                submit: 'yes'
                }).done(
                function() { 
                    self.#load();
                }
            );
    
        }
    }

    #load() {
        const self = this;

        // Wait for a file being uploaded
        $(this.options.fabLoadElement).off('change').one('change', (e) => {
            let file = e.target.files[0];
            let fr = new FileReader();

            // Read the file
            fr.readAsText(file);
            fr.onload = function(data) {
                let fileContent = JSON.parse(data.target.result);

                // Check if this is a valid export file
                if(fileContent['valid'] == 'true' && fileContent['methodology'] == self.methodology.id) {
                    let checkVersion = false;

                    // If the application has the same version number as saved in the export file, we're good.
                    let fileVersion = fileContent['version'].split('.');
                    let appVersion = self.version.split('.');

                    // We only check for the major and minor version numbers (Semantic Versioning is used)
                    if(fileVersion[0] == appVersion[0] && fileVersion[1] == appVersion[1] ) {
                        self.#loadNewContent(fileContent['items']);
                    }
                    else {
                        // We have a valid file, but made in a previous version, ask for permission
                        $.toast({
                            type: 'confirm', 
                            position: 'center',
                            message: 'The export file is made in another version(' + fileContent['version'] + ') then the current application version(' + self.version + '). Are you sure you want to import this file?',
                            cancel: 'no',
                            submit: 'yes'
                        }).done(
                            function() { 
                                self.#loadNewContent(fileContent['items']);
                            }
                        );
                    }
                }
                else {
                    $.toast({
                        type: 'warning', 
                        position: 'center',
                        autoDismiss: true,
                        hideClose: true,
                        message: 'Imported file is not valid, cannot import this file.'
                    });
                }
            }
            self.closeFabIcon();

            // Clear file upload, to make sure we can import the same file if necessary
            e.target.value = "";
        });
        $(this.options.fabLoadElement).trigger('click');
    }

    #loadNewContent(fileContent){
        // Clear the current design
        this.#clear();
        // Save the items from the export file to the local storage
        this.db.saveItems(this.methodology.id, fileContent);
        // reset the screen with the imported items

        // We need to loadItems in each phase
        $.each (this.phases.list, function ( index, phase ) {
            phase.itemList.loadItems(phase.id);
        });
    }

    about(tabIndex) {
        this.#openModal(tabIndex);
        this.closeMenu();
    }

    #openModal = function (tab) {
        $('#tab-0' + tab).prop('checked', 'true');
        this.aboutElement.addClass('show');
        $(this.options.aboutModal + ' ' + this.options.modalOverlay).off('click').on('click', (e) => { this.#closeModal(e); });
        this.modalOverlayElement.off('click').on('click', (e) => { this.#closeModal(e); });
        this.modalCloseElement.off('click').on('click', (e) => { this.#closeModal(e); });
    }

    #closeModal = function(e) {
        this.aboutElement.removeClass('show');
    }    

    resetItemPositions() {
        const self = this;
        $.toast({
            type: 'confirm', 
            position: 'center',
            message: 'Are you sure want to realign all items to the top left corner?<br>(usefull when items are outside the phase canvas.)',
            cancel: 'no',
            submit: 'yes'
        }).done(
            function() { 
                for(let p = 0; p < self.phases.list.length; p++) {
                    let itemList = self.phases.list[p].itemList.list;
        
                    $.each ( itemList, function( index, item ) {
                        item.position = {top: 10, left: 10};
                        item.save();
                        $('#' + item.id).css('top', '10');
                        $('#' + item.id).css('left', '10');
                    });
                }
                self.closeFabIcon();
            }
        ).fail(
            function() {
                self.closeFabIcon();
            }
        );
    }

    setDb(setting) {
        let db = localStorage['db'] || 'local';
        if(typeof(setting) != 'undefined') {
            db = setting;
        }

        if(db == 'online') {
            this.db = new DbOnlineStorage();
        }
        else {
            this.db = new DbLocalStorage();
        }

        let oldIcon = (db == 'local') ? 'on': 'off';
        let newIcon = (db == 'local') ? 'off': 'on';

        $(this.options.fabDatabaseToggle).removeClass('fa-toggle-' + oldIcon);
        $(this.options.fabDatabaseToggle).addClass('fa-toggle-' + newIcon);

        localStorage['db'] = db;
    }

    toggleDatabase() {
        let newSetting = (typeof(localStorage['db']) == 'undefined' || localStorage['db'] == 'local') ? 'online': 'local';
        this.setDb(newSetting);
        this.closeFabIcon();
        // Todo refresh canvas
    }

}