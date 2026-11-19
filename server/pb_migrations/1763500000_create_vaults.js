/// <reference path="../pb_data/types.d.ts" />

// One collection for Sabr. Everything in `data` is encrypted on the phone,
// so the server (and anyone with admin access to it) only sees scrambled text.
migrate(
  (app) => {
    const vaults = new Collection({
      type: 'base',
      name: 'vaults',
      // Only you can list or change your own vaults.
      listRule: 'owner = @request.auth.id',
      // A shared status can be read by anyone who knows its id (the share code). It is
      // still encrypted with a key that only exists in the share code.
      viewRule: "owner = @request.auth.id || kind = 'share'",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: 'owner = @request.auth.id && @request.body.owner:isset = false && @request.body.kind:isset = false',
      deleteRule: 'owner = @request.auth.id',
      fields: [
        { name: 'owner', type: 'relation', required: true, maxSelect: 1, collectionId: '_pb_users_auth_', cascadeDelete: true },
        { name: 'kind', type: 'select', required: true, maxSelect: 1, values: ['backup', 'share'] },
        { name: 'data', type: 'text', required: true, max: 20000000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_vaults_owner ON vaults (owner)'],
    });
    app.save(vaults);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('vaults'));
  },
);
