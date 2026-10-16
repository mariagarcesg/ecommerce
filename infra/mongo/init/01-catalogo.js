// Se ejecuta solo la primera vez que se crea el volumen de MongoDB.
// Crea la base "catalogo" y un usuario que solo puede usar esa base.
db = db.getSiblingDB('catalogo');
db.createUser({
  user: 'catalogo',
  pwd: 'catalogo',
  roles: [{ role: 'readWrite', db: 'catalogo' }],
});
