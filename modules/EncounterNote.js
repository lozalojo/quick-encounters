/*
Extend the placeable Map Note - select the desired tokens and then tap the Quick Encounters button
Subsequently can add: (a) Drag additional tokens in, (b) populate the Combat Tracker when you open the note?
27-Aug-2020   Created
30-Aug-2020   Added EncounterNoteConfig
13-Sep-2020    QuickEncounter.deleteNote moved/renamed to EncounterNote.delete
                QuickEncounter.placeNote moved/renamed to EncounterNote.place
                Fixed flow of deleteJournalEntry --> delete associated Note
14-Sep-2020     Display simple dialog when you delete the Map Note corresponding to a Quick Encounter Journal Entry
15-Sep-2020     v0.4.0 i18n for deleting Journal Note
                v0.4.1 delete() - rewrite for getEncounterScene returning the scene not the ID
16-Sep-2020     v0.4.1 place() - if there aren't token coords, and option=placeDefault, then place a map note in the center
21-Sep-2020     v0.4.2: BUG: Dialog.prompt doesn't exist in Foundry 0.6.6 - replace with our own
26-Sep-2020     v0.5.0: Use QuickEncounter.switchToMapNoteScene
27-Sep-2020     v0.5.0: Bypass the Note Config sheet - just create it and allow for updating later
                v0.5.0: NYI: Base code for Hook on renderNoteCOnfig to change it to look like a QE Note (but need a way of determining a QE Note)
*/


import {MODULE_NAME, SCENE_ID_FLAG_KEY, TOKENS_FLAG_KEY} from './QuickEncounter.js';
import {QuickEncounter} from './QuickEncounter.js';

//Expand the available list of Note icons
const moreNoteIcons = {
    "Combat" : "icons/svg/combat.svg"
}
Object.assign(CONFIG.JournalEntry.noteIcons, moreNoteIcons);



export class EncounterNoteConfig extends NoteConfig {
    /** @override  */
    //WARNING: Do not add submitOnClose=true because that will create a submit loop
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id : "encounter-note-config",
            title : game.i18n.localize( "QE.Config.TITLE")
        });
    }
}

export class EncounterNote{
    static async create(journalEntry, noteAnchor) {
        if (!journalEntry) {return;}
        // Create Note data
        const noteData = {
              entryId: journalEntry.id,
              x: noteAnchor.x,
              y: noteAnchor.y,
              icon: CONFIG.JournalEntry.noteIcons.Combat,
              iconSize: 80,
              iconTint: "#FF0000",  //Red
              //Don't specify the name so it inherits from the Journal
              textAnchor: CONST.TEXT_ANCHOR_POINTS.TOP,
              fontSize: 24
        };

        //v0.5.0: Switch to Note.create() to bypass the NOte dialog
        //This is different from the JournalEntry._onDropData approach
        let newNote = await Note.create(noteData);
        newNote._sheet = new EncounterNoteConfig(newNote);
    }

    static async delete(journalEntry) {
        if (!game.user.isGM) {return;}
        const scene = QuickEncounter.getEncounterScene(journalEntry);
        if (scene) {
            //Find the corresponding Map note - have to switch to the correct scene first
            if (!await QuickEncounter.switchToMapNoteScene(scene, journalEntry)) {return;}
            const note = journalEntry.sceneNote;
            const noteName = note.name;

            //Delete the note from the viewed scene
            if (note) {
                //0.4.2: Replaces Dialog.prompt from Foundry 0.7.2
                EncounterNote.dialogPrompt({
                  title: game.i18n.localize("QE.DeletedJournalNote.TITLE"),
                  content: game.i18n.localize("QE.DeletedJournalNote.CONTENT"),
                  label : "",
                  callback : () => {console.log(`Deleted Map Note ${noteName}`);},
                  options: {
                    top:  window.innerHeight - 350,
                    left: window.innerWidth - 720,
                    width: 400,
                    jQuery: false
                  }
                });
                canvas.notes.deleteMany([note.id]);
            }
        }
    }

    static dialogPrompt({title, content, label, callback}={}, options={}) {
        return new Promise(resolve => {
          const dialog = new Dialog({
            title: title,
            content: content,
            buttons: {
              close: {
                icon: '<i class="fas fa-check"></i>',
                label: label,
                callback: callback
              }
            },
            default: "close",
            close: resolve
          }, options);
          dialog.render(true);
        });
    }

    static async place(qeJournalEntry, options={}) {
        if (!qeJournalEntry) {return;}
        const savedTokens = qeJournalEntry.getFlag(MODULE_NAME, TOKENS_FLAG_KEY);

        //Create a Map Note for this encounter - the default is where the saved Tokens were
        let noteAnchor = {}
        if (savedTokens && savedTokens.length) {
            noteAnchor = {
                x: savedTokens[0].x,
                y: savedTokens[0].y
            }
        } else if (options.placeDefault) {
            //Otherwise, place it in the middle of the canvas stage (current view)
            noteAnchor = {
                x : canvas.stage.pivot.x,
                y : canvas.stage.pivot.y
            }
        } else {return;}
        // Validate the final position is in-bounds
        if (canvas.grid.hitArea.contains(noteAnchor.x, noteAnchor.y) ) {
            // Create a Note; we don't pop-up the Note sheet because we really want this Note to be placed
            //(they can always edit it afterwards)
            const newNote = await EncounterNote.create(qeJournalEntry, noteAnchor);
        }
    }

}

//Delete a corresponding Map Note if you delete the Journal Entry
Hooks.on("deleteJournalEntry", EncounterNote.delete);

//Pretty up the first Map Note (hopefully we can do the same for others)
Hooks.on(`renderEncounterNoteConfig`, async (noteConfig, html, data) => {
    const updateEncounterMapNote = game.i18n.localize("QE.UpdateEncounterMapNote.BUTTON");
    html.find('button[name="submit"]').text(updateEncounterMapNote);
});

//NOT YET IMPLEMENTED
//If you drag a Quick Encounter Journal Entry to the Scene, then intercept it to render it similarly,
//but this time allow you to change stuff
Hooks.on(`renderNoteConfig`, async (noteConfig, html, data) => {
    const note = noteConfig.object;
    const journalEntry = note.entry;

//FIXME: Temporary so that we skip this until we can determine if something is a Quick Encounter just from the Journal Entry (not the sheet)
    const isQEJournalEntry = false;

    if (noteConfig.intercepted || !isQEJournalEntry) {return;}
    mergeObject(data.object, {
        icon: CONFIG.JournalEntry.noteIcons.Combat,
        iconSize: 80,
        iconTint: "#FF0000",  //Red
        //Don't specify the name so it inherits from the Journal
        textAnchor: CONST.TEXT_ANCHOR_POINTS.TOP,
        fontSize: 24
    })


    const newInnerHtml = await noteConfig._renderInner(data);
    if (noteConfig.element.length ) {noteConfig._replaceHTML(noteConfig.element, newInnerHtml);}
    noteConfig.activateListeners(newInnerHtml);
    noteConfig.intercepted = true;
});
