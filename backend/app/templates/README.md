# DOCX template files

Place template binaries in this directory:

- `soglasie_template_general.docx`
- `soglasie_template_invasia.docx`
- `soglasie_template_pregnant.docx`

Generation rules:

- `general` and `invasia` are always generated
- `pregnant` is generated only when `gender=female`

Supported placeholders:

- `{{ agreement_id }}`
- `{{ date }}` / `{{date}}`
- `{{ full_name }}`
- `{{Дата рождения}}`
- `{{ phone }}`
- `{{ iin }}`
- `{{пол}}`
- `{{ allergy }}`
- `{{ procedure }}`
- `{{ signature }}`

`{{ signature }}` is rendered as an inline PNG image.
