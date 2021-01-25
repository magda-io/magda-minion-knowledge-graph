import sys, json
from entity_extraction import get_nodes_from_text


def main():
    txt_content = sys.stdin.read()
    triples = get_nodes_from_text(txt_content)
    json.dump(triples, sys.stdout)

main()