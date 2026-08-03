# DOCX template files

Place template binaries in this directory (underscore and space variants are both supported):

- `soglasie_template_general.docx`
- `soglasie_template general.docx`
- `soglasie_template_invasia.docx`
- `soglasie_template invasia.docx`
- `soglasie_template_pregnant.docx`
- `soglasie_template pregnant.docx`

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
