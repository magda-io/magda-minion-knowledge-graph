import sys, json
from entity_extraction import get_entities_from_text


def main():
    txt_content = sys.stdin.read()
    ents = get_entities_from_text(txt_content)
    json.dump(ents, sys.stdout)

main()