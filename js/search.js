(function () {
    document.ready(function () {
        var input = document.getElementById('note-search');
        var results = document.getElementById('search-results');
        var status = document.getElementById('search-status');

        if (!input || !results || !status) return;

        var posts = [];

        function clearResults() {
            while (results.firstChild) results.removeChild(results.firstChild);
        }

        function render(query) {
            clearResults();
            var keyword = query.trim().toLowerCase();

            if (!keyword) {
                status.textContent = '输入关键词开始搜索';
                return;
            }

            var matches = posts.filter(function (post) {
                return post.searchText.indexOf(keyword) !== -1;
            }).slice(0, 30);

            status.textContent = matches.length ? '找到 ' + matches.length + ' 篇笔记' : '没有找到匹配的笔记';

            matches.forEach(function (post) {
                var article = document.createElement('article');
                article.className = 'search-result';

                var link = document.createElement('a');
                link.className = 'search-result-title';
                link.href = post.path;
                link.textContent = post.title;

                var meta = document.createElement('div');
                meta.className = 'search-result-meta';
                meta.textContent = [post.date].concat(post.categories).concat(post.tags).join(' · ');

                var excerpt = document.createElement('p');
                excerpt.textContent = post.text.slice(0, 180);

                article.appendChild(link);
                article.appendChild(meta);
                article.appendChild(excerpt);
                results.appendChild(article);
            });
        }

        fetch(input.getAttribute('data-search-url'))
            .then(function (response) {
                if (!response.ok) throw new Error('search index unavailable');
                return response.json();
            })
            .then(function (data) {
                posts = (data.posts || []).map(function (post) {
                    post.searchText = [post.title, post.text].concat(post.categories || [], post.tags || []).join(' ').toLowerCase();
                    return post;
                });
                input.disabled = false;
                render('');
            })
            .catch(function () {
                status.textContent = '搜索索引加载失败，请稍后重试';
            });

        input.disabled = true;
        input.addEventListener('input', function () {
            render(input.value);
        });
    });
})();
