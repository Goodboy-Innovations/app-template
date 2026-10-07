# notes

The example module: short notes that signed-in users share, each with an optional file. Replace it with the app's own modules.

- **Owns**
  - `notes`: author, text, and the file's object key, name and size
  - The objects under `<S3_PREFIX>notes/` in the bucket
- **Rules**
  - Anyone signed in reads every note; only its author deletes it
  - Text: 1 to `MAX_BODY_LENGTH` characters. Files: up to `MAX_FILE_BYTES`, only when uploads are on (`S3_*` set)
  - Files are always served as downloads (`application/octet-stream`), never shown inline
    - So an uploaded HTML or SVG file can't run scripts on the app's address
  - The author is a user id from `identity`, without a foreign key, and named through `identity`'s `getUserNames`
- **Why**
  - Shows the module rules: other code uses `index.ts` only, and only `service.ts` writes to `notes`
  - No foreign keys into another module's tables, so each module can change its own tables freely
  - The object is stored before the row and deleted after it, so a row never points to a missing file
