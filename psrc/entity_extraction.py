import spacy
from spacy import displacy
from spacy.tokens import Span
from spacy.matcher import Matcher
import networkx as nx
from typing import Any, Tuple, Union, Dict, List

import copy
from spacy.lang.en.stop_words import STOP_WORDS
import re

nlp = spacy.load("en_core_web_md")

pos = ['NOUN', 'PROPN', 'PRON', 'ADJ', 'VERB']
mod = ['nsubj', 'conj', 'compound', 'nmod',
       'dobj', 'oprd', 'advcl', 'amod', 'appos']


def extract_entity(sen: str):
    sen_doc = nlp(sen)
    token_list = []
    for token in sen_doc:
        if token.text in ['a', 'an', 'the', 'The']:
            continue
        token_list.append(token.text)

    sen = ' '.join(token_list)
    sen_doc = nlp(sen)

    root = ''
    for token in sen_doc:
        if token.dep_ == 'ROOT':
            root = token
#     print('# ROOT: ', root)

    paths = []

    def traverse(node, path=[]):
        path.append(node)
        if len(list(node.children)) == 0:
            paths.append(copy.copy(path))
            path.pop()
        else:
            for child in node.children:
                traverse(child, path)
            path.pop()

    traverse(root)

#     print(paths)
#     paths = [p for p in paths if p[-1].pos_ in pos and p[-1].dep_ in mod ]
    paths = [p for p in paths if p[-1].pos_ in pos]

#     print('\n--------')
#     print(paths)

    paths_ = []
    for p in paths:
        path = []
        for t in p:
            if t.dep_ in mod:
                path.append(t)
        paths_.append(path)

    tokens = list(sen_doc)
    p_root = tokens.index(root)

    left, right = [], []
    for p in paths_:
        if len(p) > 0 and tokens.index(p[-1]) < p_root:
            left += p
        else:
            right += p

    return [list(set(left)), list(set(right)), root]


def get_nodes_from_text(text: str) -> List[Tuple[Tuple[str, str, str], str]]:
    """Get (subject, relationship, object) list from given test

    Args:
        text (str): text content

    Returns:
        List[Tuple[Tuple[str, str, str], str]]: each item of the returned list is a Tuple that 
        - first element of the tuple is a tuple contains subject, relationship, object string
        - second element of the tuple is a string that is the source sentence
    """

    checkWords = ('Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.',
                  'Jul.', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.')
    repWords = ('January', 'Febrary', 'March', 'April', 'May', 'June',
                'July', 'Auguest', 'September', 'October', 'November', 'December')
    for check, rep in zip(checkWords, repWords):
        text = text.replace(check, rep)

    doc = nlp(text)
    sents = [str(sent) for sent in doc.sents]
    sents

    node_rel_list = []

    for sent in sents:
        entities = extract_entity(sent)
        sub = " ".join(map(lambda item: item.text, entities[0])).strip()
        obj = " ".join(map(lambda item: item.text, entities[1])).strip()
        rel = entities[2].text.strip()
        if not sub or not obj or not rel:
            continue
        node_rel_list.append(((sub, obj, rel), sent))

    return node_rel_list


