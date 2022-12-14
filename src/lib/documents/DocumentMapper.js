"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapSelectionRangeToParent = exports.mapCodeActionToOriginal = exports.mapTextDocumentEditToOriginal = exports.mapLocationLinkToOriginal = exports.mapSymbolInformationToOriginal = exports.mapColorPresentationToOriginal = exports.mapDiagnosticToGenerated = exports.mapEditToOriginal = exports.mapInsertReplaceEditToOriginal = exports.mapObjWithRangeToOriginal = exports.mapHoverToParent = exports.mapCompletionItemToOriginal = exports.mapRangeToGenerated = exports.mapRangeToOriginal = exports.SourceMapDocumentMapper = exports.FragmentMapper = exports.IdentityMapper = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const utils_1 = require("./utils");
const logger_1 = require("../../logger");
/**
 * Does not map, returns positions as is.
 */
class IdentityMapper {
    constructor(url, parent) {
        this.url = url;
        this.parent = parent;
    }
    getOriginalPosition(generatedPosition) {
        if (this.parent) {
            generatedPosition = this.getOriginalPosition(generatedPosition);
        }
        return generatedPosition;
    }
    getGeneratedPosition(originalPosition) {
        if (this.parent) {
            originalPosition = this.getGeneratedPosition(originalPosition);
        }
        return originalPosition;
    }
    isInGenerated(position) {
        if (this.parent && !this.parent.isInGenerated(position)) {
            return false;
        }
        return true;
    }
    getURL() {
        return this.url;
    }
    destroy() {
        var _a, _b;
        (_b = (_a = this.parent) === null || _a === void 0 ? void 0 : _a.destroy) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
}
exports.IdentityMapper = IdentityMapper;
/**
 * Maps positions in a fragment relative to a parent.
 */
class FragmentMapper {
    constructor(originalText, tagInfo, url) {
        this.originalText = originalText;
        this.tagInfo = tagInfo;
        this.url = url;
    }
    getOriginalPosition(generatedPosition) {
        const parentOffset = this.offsetInParent(utils_1.offsetAt(generatedPosition, this.tagInfo.content));
        return utils_1.positionAt(parentOffset, this.originalText);
    }
    offsetInParent(offset) {
        return this.tagInfo.start + offset;
    }
    getGeneratedPosition(originalPosition) {
        const fragmentOffset = utils_1.offsetAt(originalPosition, this.originalText) - this.tagInfo.start;
        return utils_1.positionAt(fragmentOffset, this.tagInfo.content);
    }
    isInGenerated(pos) {
        const offset = utils_1.offsetAt(pos, this.originalText);
        return offset >= this.tagInfo.start && offset <= this.tagInfo.end;
    }
    getURL() {
        return this.url;
    }
}
exports.FragmentMapper = FragmentMapper;
class SourceMapDocumentMapper {
    constructor(consumer, sourceUri, parent) {
        this.consumer = consumer;
        this.sourceUri = sourceUri;
        this.parent = parent;
    }
    getOriginalPosition(generatedPosition) {
        if (this.parent) {
            generatedPosition = this.parent.getOriginalPosition(generatedPosition);
        }
        if (generatedPosition.line < 0) {
            return { line: -1, character: -1 };
        }
        const mapped = this.consumer.originalPositionFor({
            line: generatedPosition.line + 1,
            column: generatedPosition.character
        });
        if (!mapped) {
            return { line: -1, character: -1 };
        }
        if (mapped.line === 0) {
            logger_1.Logger.log('Got 0 mapped line from', generatedPosition, 'col was', mapped.column);
        }
        return {
            line: (mapped.line || 0) - 1,
            character: mapped.column || 0
        };
    }
    getGeneratedPosition(originalPosition) {
        if (this.parent) {
            originalPosition = this.parent.getGeneratedPosition(originalPosition);
        }
        const mapped = this.consumer.generatedPositionFor({
            line: originalPosition.line + 1,
            column: originalPosition.character,
            source: this.sourceUri
        });
        if (!mapped) {
            return { line: -1, character: -1 };
        }
        const result = {
            line: (mapped.line || 0) - 1,
            character: mapped.column || 0
        };
        if (result.line < 0) {
            return result;
        }
        return result;
    }
    isInGenerated(position) {
        if (this.parent && !this.isInGenerated(position)) {
            return false;
        }
        const generated = this.getGeneratedPosition(position);
        return generated.line >= 0;
    }
    getURL() {
        return this.sourceUri;
    }
    /**
     * Needs to be called when source mapper is no longer needed in order to prevent memory leaks.
     */
    destroy() {
        var _a, _b;
        (_b = (_a = this.parent) === null || _a === void 0 ? void 0 : _a.destroy) === null || _b === void 0 ? void 0 : _b.call(_a);
        this.consumer.destroy();
    }
}
exports.SourceMapDocumentMapper = SourceMapDocumentMapper;
function mapRangeToOriginal(fragment, range) {
    // DON'T use Range.create here! Positions might not be mapped
    // and therefore return negative numbers, which makes Range.create throw.
    // These invalid position need to be handled
    // on a case-by-case basis in the calling functions.
    const originalRange = {
        start: fragment.getOriginalPosition(range.start),
        end: fragment.getOriginalPosition(range.end)
    };
    // Range may be mapped one character short - reverse that for "in the same line" cases
    if (originalRange.start.line === originalRange.end.line &&
        range.start.line === range.end.line &&
        originalRange.end.character - originalRange.start.character ===
            range.end.character - range.start.character - 1) {
        originalRange.end.character += 1;
    }
    return originalRange;
}
exports.mapRangeToOriginal = mapRangeToOriginal;
function mapRangeToGenerated(fragment, range) {
    return vscode_languageserver_1.Range.create(fragment.getGeneratedPosition(range.start), fragment.getGeneratedPosition(range.end));
}
exports.mapRangeToGenerated = mapRangeToGenerated;
function mapCompletionItemToOriginal(fragment, item) {
    if (!item.textEdit) {
        return item;
    }
    return Object.assign(Object.assign({}, item), { textEdit: mapEditToOriginal(fragment, item.textEdit) });
}
exports.mapCompletionItemToOriginal = mapCompletionItemToOriginal;
function mapHoverToParent(fragment, hover) {
    if (!hover.range) {
        return hover;
    }
    return Object.assign(Object.assign({}, hover), { range: mapRangeToOriginal(fragment, hover.range) });
}
exports.mapHoverToParent = mapHoverToParent;
function mapObjWithRangeToOriginal(fragment, objWithRange) {
    return Object.assign(Object.assign({}, objWithRange), { range: mapRangeToOriginal(fragment, objWithRange.range) });
}
exports.mapObjWithRangeToOriginal = mapObjWithRangeToOriginal;
function mapInsertReplaceEditToOriginal(fragment, edit) {
    return Object.assign(Object.assign({}, edit), { insert: mapRangeToOriginal(fragment, edit.insert), replace: mapRangeToOriginal(fragment, edit.replace) });
}
exports.mapInsertReplaceEditToOriginal = mapInsertReplaceEditToOriginal;
function mapEditToOriginal(fragment, edit) {
    return vscode_languageserver_1.TextEdit.is(edit)
        ? mapObjWithRangeToOriginal(fragment, edit)
        : mapInsertReplaceEditToOriginal(fragment, edit);
}
exports.mapEditToOriginal = mapEditToOriginal;
function mapDiagnosticToGenerated(fragment, diagnostic) {
    return Object.assign(Object.assign({}, diagnostic), { range: mapRangeToGenerated(fragment, diagnostic.range) });
}
exports.mapDiagnosticToGenerated = mapDiagnosticToGenerated;
function mapColorPresentationToOriginal(fragment, presentation) {
    const item = Object.assign({}, presentation);
    if (item.textEdit) {
        item.textEdit = mapObjWithRangeToOriginal(fragment, item.textEdit);
    }
    if (item.additionalTextEdits) {
        item.additionalTextEdits = item.additionalTextEdits.map((edit) => mapObjWithRangeToOriginal(fragment, edit));
    }
    return item;
}
exports.mapColorPresentationToOriginal = mapColorPresentationToOriginal;
function mapSymbolInformationToOriginal(fragment, info) {
    return Object.assign(Object.assign({}, info), { location: mapObjWithRangeToOriginal(fragment, info.location) });
}
exports.mapSymbolInformationToOriginal = mapSymbolInformationToOriginal;
function mapLocationLinkToOriginal(fragment, def) {
    return vscode_languageserver_1.LocationLink.create(def.targetUri, fragment.getURL() === def.targetUri
        ? mapRangeToOriginal(fragment, def.targetRange)
        : def.targetRange, fragment.getURL() === def.targetUri
        ? mapRangeToOriginal(fragment, def.targetSelectionRange)
        : def.targetSelectionRange, def.originSelectionRange
        ? mapRangeToOriginal(fragment, def.originSelectionRange)
        : undefined);
}
exports.mapLocationLinkToOriginal = mapLocationLinkToOriginal;
function mapTextDocumentEditToOriginal(fragment, edit) {
    if (edit.textDocument.uri !== fragment.getURL()) {
        return edit;
    }
    return vscode_languageserver_1.TextDocumentEdit.create(edit.textDocument, edit.edits.map((textEdit) => mapObjWithRangeToOriginal(fragment, textEdit)));
}
exports.mapTextDocumentEditToOriginal = mapTextDocumentEditToOriginal;
function mapCodeActionToOriginal(fragment, codeAction) {
    return vscode_languageserver_1.CodeAction.create(codeAction.title, {
        documentChanges: codeAction.edit.documentChanges.map((edit) => mapTextDocumentEditToOriginal(fragment, edit))
    }, codeAction.kind);
}
exports.mapCodeActionToOriginal = mapCodeActionToOriginal;
function mapSelectionRangeToParent(fragment, selectionRange) {
    const { range, parent } = selectionRange;
    return vscode_languageserver_1.SelectionRange.create(mapRangeToOriginal(fragment, range), parent && mapSelectionRangeToParent(fragment, parent));
}
exports.mapSelectionRangeToParent = mapSelectionRangeToParent;
//# sourceMappingURL=DocumentMapper.js.map