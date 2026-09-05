"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const { fetchApi } = require("@libs/fetch");
const { NovelStatus } = require("@libs/novelStatus");
const { load: parseHTML } = require("cheerio");

class BooktokiPlugin {
    constructor() {
        this.id = 'booktoki';
        this.name = 'Booktoki';
        this.version = '1.0.4';
        this.icon = 'siteNotAvailable.png';
        // 관문(Gateway) 주소 지정
        this.site = 'https://newtoki1.org/book';
        this.currentUrl = null;
    }

    // newtoki1.org/book 리다이렉트를 추적하여 현재 살아있는 실제 도메인 확보
    async getBaseUrl() {
        if (this.currentUrl) return this.currentUrl;
        try {
            const res = await fetchApi(this.site);
            if (res.ok && res.url) {
                // 리다이렉트된 최종 URL의 origin (예: https://booktokiXXX.com) 추출
                const parsed = new URL(res.url);
                this.currentUrl = parsed.origin;
                return this.currentUrl;
            }
        } catch (e) {}
        return this.site;
    }

    async popularNovels(pageNo, { showLatestNovels }) {
        const baseUrl = await this.getBaseUrl();
        const sortParam = showLatestNovels ? 'as_update' : 'as_view';
        const url = `${baseUrl}/novel?sst=${sortParam}&sod=desc&page=${pageNo}`;
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
                path: href.replace(baseUrl, ''),
                cover: cover ? (cover.startsWith('http') ? cover : baseUrl + cover) : undefined,
            });
        });
        return novels;
    }

    async parseNovel(novelPath) {
        const baseUrl = await this.getBaseUrl();
        const url = baseUrl + novelPath;
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
                    path: href.replace(baseUrl, ''),
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
                const targetPageUrl = pageUrl.startsWith('http') ? pageUrl : baseUrl + pageUrl;
                const pageRes = await fetchApi(targetPageUrl);
                const pageBody = await pageRes.text();
                parseChapters(parseHTML(pageBody));
            } catch (_) {}
        }

        novel.chapters = chapters;
        return novel;
    }

    async parseChapter(chapterPath) {
        const baseUrl = await this.getBaseUrl();
        const targetUrl = baseUrl + chapterPath;
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
        const baseUrl = await this.getBaseUrl();
        const url = `${baseUrl}/novel?stx=${encodeURIComponent(searchTerm)}&page=${pageNo}`;
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
                path: href.replace(baseUrl, ''),
                cover: cover ? (cover.startsWith('http') ? cover : baseUrl + cover) : undefined,
            });
        });
        return novels;
    }
}

exports.default = new BooktokiPlugin();