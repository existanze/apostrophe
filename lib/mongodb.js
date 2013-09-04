var _ = require('underscore');
var async = require('async');

/**
 * mongodb
 * @augments Augments the apos object with methods relating to
 * MongoDB and the MongoDB collections that Apostrophe requires.
 *
 **/

module.exports = function(self) {
  function setupPages(callback) {
    self.db.collection('aposPages', function(err, collection) {
      function indexSlug(callback) {
        self.pages.ensureIndex({ slug: 1 }, { safe: true, unique: true }, callback);
      }
      function indexTags(callback) {
        self.pages.ensureIndex({ tags: 1 }, { safe: true }, callback);
      }
      self.pages = collection;
      async.series([indexSlug, indexTags], callback);
      // ... more index functions
    });
  }

  // Each time a page or area is updated with putArea or putPage, a new version
  // object is also created. Regardless of whether putArea or putPage is called,
  // if the area is in the context of a page it is the entire page that is
  // versioned. A pageId or areaId property is added, which is a non-unique index
  // allowing us to fetch prior versions of any page or independently stored
  // area. Also createdAt and author. Author is a string to avoid issues with
  // references to deleted users.
  //
  // Note that this also provides full versioning for types built upon pages, such as
  // blog posts and snippets.

  function setupVersions(callback) {
    self.db.collection('aposVersions', function(err, collection) {
      function index(callback) {
        self.versions.ensureIndex({ pageId: 1, createdAt: -1 }, { safe: true }, callback);
      }
      self.versions = collection;
      async.series([index], callback);
      // ... more index functions
    });
  }

  function setupFiles(callback) {
    self.db.collection('aposFiles', function(err, collection) {
      self.files = collection;
      return callback(err);
    });
  }

  function setupVideos(callback) {
    self.db.collection('aposVideos', function(err, collection) {
      function searchIndex(callback) {
        self.videos.ensureIndex({ searchText: 1 }, { safe: true }, callback);
      }
      // Index the URLs
      function videoIndex(callback) {
        self.videos.ensureIndex({ video: 1 }, { safe: true }, callback);
      }
      self.videos = collection;
      return async.series([searchIndex, videoIndex], callback);
    });
  }

  function setupRedirects(callback) {
    self.db.collection('aposRedirects', function(err, collection) {
      self.redirects = collection;
      collection.ensureIndex({ from: 1 }, { safe: true, unique: true }, function(err) {
        return callback(err);
      });
    });
  }

  /**
   * Ensure the MongoDB collections required by Apostrophe are available in the expected
   * properties (apos.pages, etc).
   * @param  {Function} callback
   */
  self.initCollections = function(callback) {
    return async.series([setupPages, setupVersions, setupFiles, setupVideos, setupRedirects], callback);
  };

  // Is this MongoDB error related to uniqueness? Great for retrying on duplicates.
  // Used heavily by the pages module and no doubt will be by other things.
  //
  // There are three error codes for this: 13596 ("cannot change _id of a document")
  // and 11000 and 11001 which specifically relate to the uniqueness of an index.
  // 13596 can arise on an upsert operation, especially when the _id is assigned
  // by the caller rather than by MongoDB.
  //
  // IMPORTANT: you are responsible for making sure ALL of your unique indexes
  // are accounted for before retrying... otherwise an infinite loop will
  // likely result.

  self.isUniqueError = function(err) {
    if (!err) {
      return false;
    }
    if (err.code === 13596) {
      return true;
    }
    return ((err.code === 13596) || (err.code === 11000) || (err.code === 11001));
  };

  // 'ids' should be an array of mongodb IDs. The elements of the 'items' array, which
  // should be the result of a mongodb query, are returned in the order specified by 'ids'.
  // This is useful after performing an $in query with MongoDB (note that $in does NOT sort its
  // results in the order given).
  //
  // Any IDs that do not actually exist for an item in the 'items' array are not returned,
  // and vice versa. You should not assume the result will have the same length as
  // either array.

  self.orderById = function(ids, items) {
    var byId = {};
    _.each(items, function(item) {
      byId[item._id] = item;
    });
    items = [];
    _.each(ids, function(_id) {
      if (byId.hasOwnProperty(_id)) {
        items.push(byId[_id]);
      }
    });
    return items;
  };
};