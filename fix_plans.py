import pathlib
p = pathlib.Path("src/views/Plans.vue")
content = p.read_text(encoding="utf-8")
replacements = [
    ("row.suite_start_mode === \"auto\" ? \"success\" : \"info\"", "row.suite_start_mode === 'auto' ? 'success' : 'info'"),
    ("row.suite_start_mode === \"auto\" ? \"自动\" : \"手动\"", "row.suite_start_mode === 'auto' ? '自动' : '手动'"),
    ("row.run_status === \"new\"", "row.run_status === 'new'"),
    ("row.run_status === \"running\"", "row.run_status === 'running'"),
]
for old, new in replacements:
    content = content.replace(old, new)
p.write_text(content, encoding="utf-8")
print("fixed", len(replacements), "patterns")
