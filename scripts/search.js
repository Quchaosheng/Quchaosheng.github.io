'use strict';

const { stripHTML } = require('hexo-util');

hexo.extend.generator.register('search', function (locals) {
  const posts = locals.posts.sort('date', -1).map((post) => ({
    title: post.title,
    path: '/' + post.path.replace(/^\/+/, ''),
    date: post.date.format('YYYY-MM-DD'),
    categories: post.categories.map((item) => item.name),
    tags: post.tags.map((item) => item.name),
    text: stripHTML(post.content || '').replace(/\s+/g, ' ').trim()
  }));

  return {
    path: 'search.json',
    data: JSON.stringify({ posts })
  };
});
