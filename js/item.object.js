import { Modal } from './modal.object.js';

export class Item {
    #parent;
    #root;

    constructor(parent, item) {
        // We always save the parent and the root class object so that we can find our way up if necessary
        this.#parent = parent;
        this.#root = parent.root;

        this.position = {};

        // If an Item is given in the constructor, load the properties of that Item in this class
        if (typeof item != 'undefined') {
            this.id = item.id;
            this.title = item.title;
            this.phase = item.phase;
            this.description = item.description;
            this.researchQuestion = item.researchQuestion;
            this.researchStrategy = item.researchStrategy;
            this.researchMethod = item.researchMethod;
            this.researchConclusions = item.researchConclusions;
            this.researchResults = item.researchResults;
            if(typeof item.position == 'undefined') {
                this.position = {top: 100, left: 100};
            }
            else {
                this.position = item.position;
            }
        }
        // If no Item is given, initialize the properties as empty.
        else {
            this.id = '';
            this.title = '';
            this.phase = '';
            this.description = '';
            this.researchQuestion = '';
            this.researchStrategy = '';
            this.researchMethod = '';
            this.researchConclusions = '';
            this.researchResults = '';
            // By default all Items are positioned at top 100 and left 100
            this.position = {top: 100, left: 100};
        }
    }

    // We use getter setter for parent and root, because we dont want the parent in the ocalStorage
    //      (JSON.stringify will fail in items.object.js/newItem eventListener)
    get parent() {
        return this.#parent;
    }
    set parent(obj) {
        this.#parent = obj;
    }
    get root() {
        return this.#root;
    }
    set root(obj) {
        this.#root = obj;
    }

    // We can load an Item by its id directly from the local storage
    load(id) {
        let item = this.#root.db.loadItem(this.#root.methodology.id, id);

        this.id = item.id;
        this.title = item.title;
        this.phase = item.phase;
        this.description = item.description;
        this.researchQuestion = item.researchQuestion;
        this.researchStrategy = item.researchStrategy;
        this.researchMethod = item.researchMethod;
        this.researchConclusions = item.researchConclusions;
        this.researchResults = item.researchResults;
        this.position = item.position;
    }

    // Render this element as an HTML element on the screen
    render() {
        // Different styles are applied when an Item has research conclusions or results
        let hasResults = '';
        if (this.researchConclusions !='' || this.researchResults != '') {
            hasResults = 'has-results';
        }

        // Ig this Item has a research strategy, show its matching image next to the title
        let imageElement = '';
        if (this.researchStrategy !='') {
            imageElement = '<img class="research-image" src="images/dotframework/dotframework' + this.researchStrategy + '.png">';
        }
        let itemElement = $('<div class="item ' + hasResults + '" id="' + this.id + '" data-phase="' + this.phase + '" data-title="' + this.title + '">' + this.title + imageElement + '</div>');

        // Make the Item HTML element draggable so we can move it to another position in this phase or move it to a different phase
        const self = this;
        itemElement.draggable({
            scroll: false,
            cursor: 'move',
            revert: 'invalid',
            item: this,
            // If we start dragging, position the mouse pointer in the middle of the element
            start: function(event, ui){
                $(this).draggable('instance').offset.click = {
                    left: Math.floor(ui.helper.width() / 2),
                    top: Math.floor(ui.helper.height() / 2)
                }; 
            },
            // If we drop a draggable Item take care of its HTML and storage
            stop: function( event, ui ) {
                let items = self.root.db.loadItems(self.root.methodology.id);

                // The Item has been moved to another phase, let's take care of the HTML and local Storage
                if(self.phase != ui.helper.attr('data-phase')) {
                    self.position = {top: 100,left: 100};

                    items[self.id].phase = self.phase;

                    // Update html
                    $('#' + self.id).detach().appendTo($('#' + self.phase)); 
                    $('#' + self.id).css(self.position);
                    $('#' + self.id).attr('data-phase', self.phase);
                }
                else {
                    // If the draggable Item is not moved to another phase, just save its new position
                    self.position = ui.position;
                }
                items[self.id].position = self.position;
                self.root.db.saveItems(self.root.methodology.id, items);
            }
        });
        // Always attach the click event after making it draggable, so it won't fire during dragging the Item
        itemElement.on('click', (e) => { this.open(); });
        // Write the created Item HTML element to its defined phase HTML element
        itemElement.css(this.position);
        itemElement.appendTo($('#' + this.#parent.parent.id));
    }

    // Open the Item into a modal, so we can edit it.
    open() {
        this.phase = this.#parent.parent.id;
        const modal = new Modal(this.#root, this.#parent.parent, this);
    }

    // Save or update the Item
    save() {
        // New Items don't have an id yet, so we create one with a random number and today's date
        if (this.id == '') {
            this.id = Math.floor(Math.random() * 26) + Date.now();
            this.position = {top: 100, left: 100};
        }
        else {
            // If we update an existing Item, we need to update the HTML element as well
            let hasResults = '';
            if (this.researchConclusions !='' || this.researchResults != '') {
                $('#' + this.id).addClass('has-results');
            }
            else {
                $('#' + this.id).removeClass('has-results');
            }
            let newTitle = this.title;
            if (this.researchStrategy !='') {
                newTitle = this.title + '<img class="research-image" src="images/dotframework/dotframework' + this.researchStrategy + '.png">';
            }
    
            $('#' + this.id).html(newTitle);
            $('#' + this.id).data('title', this.title);
        }

        // Next we have to save it in the local storage
        let items = this.root.db.loadItems(this.root.methodology.id);

        items[this.id] = {
            id: this.id, 
            title: this.title, 
            phase: this.phase, 
            description: this.description, 
            researchQuestion: this.researchQuestion,
            researchStrategy: this.researchStrategy, 
            researchMethod: this.researchMethod, 
            researchConclusions: this.researchConclusions,
            researchResults: this.researchResults,
            position: this.position
        };

        this.#root.db.saveItems(this.#root.methodology.id, items);
        return items[this.id];
    }

    remove() {
        var dfd = $.Deferred();

        const self = this;
        $.toast({
            type: 'confirm', 
            position: 'center',
            message: 'Are you sure you want to remove this item??',
            cancel: 'no',
            submit: 'yes'
        }).done(
            function() { 
                // Remove item from parent list
                self.#parent.removeItem(self.id);

                self.#root.db.deleteItem(self.#root.methodology.id, self.id);

                // remove item from screen
                $('#' + self.id).remove();

                dfd.resolve();
            }
        ).fail(
            function() {
                dfd.reject();
            }
        );
        return dfd.promise();
    }

}
