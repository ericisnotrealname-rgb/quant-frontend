import pathlib
p = pathlib.Path("src/views/Plans.vue")
content = p.read_text(encoding="utf-8")
content = content.replace(":title=\"editingId ? \"编辑 Plan\" : \"新增 Plan\"\"", ":title=\"editingId ? '编辑 Plan' : '新增 Plan'\"")
p.write_text(content, encoding="utf-8")
print("fixed")
