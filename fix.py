import re

with open('weather_app/views.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix URL 1
content = re.sub(
    r'url = f\"\n(.*?)\n\"',
    r'url = f"\1"',
    content
)

# Fix URL 3
content = re.sub(
    r'url = \"\n(.*?)\n\"',
    r'url = "\1"',
    content
)

with open('weather_app/views.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done fixing URLs in views.py")
