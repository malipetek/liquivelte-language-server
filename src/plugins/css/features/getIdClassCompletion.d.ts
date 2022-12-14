import { CompletionItem, CompletionList } from 'vscode-languageserver';
import { AttributeContext } from '../../../lib/documents/parseHtml';
import { CSSDocument } from '../CSSDocument';
export declare function getIdClassCompletion(cssDoc: CSSDocument, attributeContext: AttributeContext): CompletionList | null;
/**
 * incomplete see
 * https://github.com/microsoft/vscode-css-languageservice/blob/master/src/parser/cssNodes.ts#L14
 * The enum is not exported. we have to update this whenever it changes
 */
export declare enum NodeType {
    ClassSelector = 14,
    IdentifierSelector = 15
}
export declare type CSSNode = {
    type: number;
    children: CSSNode[] | undefined;
    getText(): string;
};
export declare function collectSelectors(stylesheet: CSSNode, type: number): CompletionItem[];
