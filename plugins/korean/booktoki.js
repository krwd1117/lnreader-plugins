"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// LNReader 필수 라이브러리 require
const { fetchApi } = require("@libs/fetch");
const { NovelStatus } = require("@libs/novelStatus");
const { load: parseHTML } = require("cheerio");

class BooktokiPlugin {
    constructor() {
        this.id = 'booktoki';
        this.name = 'Booktoki';
        this.version = '1.0.3';
        this.icon = 'siteNotAvailable.png';
        this.site = 'https://booktoki468.com'; // 현재 열리는 북토키 주소
    }

    async popularNovels(pageNo, { showLatestNovels }) {
        const sortParam = showLatestNovels ? 'as_update' : 'as_view';
        const url = `${this.site}/novel?sst=${sortParam}&sod=desc&page=${pageNo}`;
        const result = await fetchApi(url);
        const body = await result.text();
        const $ = parseHTML(body);
        const novels = [];

        $('ul#webtoon-list-all > li').each((_, element) => {
            const link = $(element).find('div.in-lable a, div.img-item a');
            const href = link.attr('href');
            if (!href) return;
            const name = $(element).attr('date-title') || link.text().trim();
            const cover = $(element).find('img.theme-thumb-img').attr('src');
            novels.push({
                name: name.trim(),
                path: href.replace(this.site, ''),
                cover: cover ? (cover.startsWith('http') ? cover : this.site + cover) : undefined,
            });
        });
        return novels;
    }

    async parseNovel(novelPath) {
        const url = this.site + novelPath;
        const result = await fetchApi(url);
        const body = await result.text();
        const $ = parseHTML(body);

        const novel = {
            path: novelPath,
            name: $('.page-title h2 span, .theme-detail-title-line').text().replace(/'/g, '').trim(),
            cover: $('div.view-img img').attr('src'),
            summary: $('div.theme-detail-description').text().trim(),
            author: $(".theme-detail-info-row:contains('작가') .theme-detail-info-value").text().trim(),
            genres: $(".theme-detail-info-row:contains('장르') .theme-detail-info-value").text().trim(),
            status: $(".theme-detail-info-row:contains('발행구분')").text().includes('완결') ? NovelStatus.Completed : NovelStatus.Ongoing,
            chapters: [],
        };

        const chapters = [];
        const parseChapters = ($doc) => {
            $doc('ul.list-body li.list-item').each((_, element) => {
                const link = $doc(element).find('a.item-subject');
                const href = link.attr('href');
                if (!href) return;
                const name = link.contents().first().text().trim() || link.text().trim();
                const releaseTime = $doc(element).find('.wr-date').text().trim();
                chapters.push({
                    name: name,
                    path: href.replace(this.site, ''),
                    releaseTime: releaseTime || undefined,
                });
            });
        };

        parseChapters($);

        const pageLinks = [];
        $('nav.theme-episode-pager a.pg_page').each((_, el) => {
            const href = $(el).attr('href');
            if (href && !pageLinks.includes(href)) {
                pageLinks.push(href);
            }
        });

        for (const pageUrl of pageLinks.slice(0, 5)) {
            try {
                const targetPageUrl = pageUrl.startsWith('http') ? pageUrl : this.site + pageUrl;
                const pageRes = await fetchApi(targetPageUrl);
                const pageBody = await pageRes.text();
                parseChapters(parseHTML(pageBody));
            } catch (_) {}
        }

        novel.chapters = chapters;
        return novel;
    }

    async parseChapter(chapterPath) {
        const targetUrl = this.site + chapterPath;
        const result = await fetchApi(targetUrl);
        const body = await result.text();
        const $ = parseHTML(body);

        let content = $('#novel_content').html() || $('.view-content').html() || '';
        if (content) {
            const $content = parseHTML(content);
            $content('script, style').remove();
            content = $content.html() || content;
        }
        return content.trim();
    }

    async searchNovels(searchTerm, pageNo) {
        const url = `${this.site}/novel?stx=${encodeURIComponent(searchTerm)}&page=${pageNo}`;
        const result = await fetchApi(url);
        const body = await result.text();
        const $ = parseHTML(body);
        const novels = [];

        $('ul#webtoon-list-all > li').each((_, element) => {
            const link = $(element).find('div.in-lable a, div.img-item a');
            const href = link.attr('href');
            if (!href) return;
            const name = $(element).attr('date-title') || link.text().trim();
            const cover = $(element).find('img.theme-thumb-img').attr('src');
            novels.push({
                name: name.trim(),
                path: href.replace(this.site, ''),
                cover: cover ? (cover.startsWith('http') ? cover : this.site + cover) : undefined,
            });
        });
        return novels;
    }
}

exports.default = new BooktokiPlugin();