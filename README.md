## How to create keyfile for server-only auth?
Run these commands in order:

`openssl ecparam -name prime256v1 -genkey -noout -out keys/server-private.pem`

`openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in server-private.pem -out server-private-pkcs8.pem`

`openssl ec -in keys/server-private.pem -pubout -out keys/server-public.pem`

Create a JWT token at jwt.io. Use `server-private-pkcs8.pem` for private key.

Update `.env`:
```conf
PUBLIC_KEY_PATH="/path/to/keys/server-public.pem"
JWT_ISSUER="issuer_name"
```

## How to create JWT token for user auth?
Generate a JWT secret `openssl rand -hex 32`

Update `.env`:
```conf
JWT_SECRET="YOUR_SECRET"
```

Request cookie must contain `auth:ENCODED_JWT_TOKEN` encrypted with `process.env.JWT_SECRET`