import pathlib
p = pathlib.Path("src/views/Plans.vue")
content = p.read_text(encoding="utf-8")

# Fix trigger_type type issue by adding type assertion to payload
content = content.replace(
    "await strategyApi.createPlan(payload)",
    "await strategyApi.createPlan(payload as PlanItem)"
)

# Fix remaining nested double quotes in template
content = content.replace('form.scopeType === "groups"', "form.scopeType === 'groups'")
content = content.replace('form.scopeType === "symbols"', "form.scopeType === 'symbols'")

p.write_text(content, encoding="utf-8")
print("Plans.vue fixed")
