const axios = require('axios');
const Domain = require('../models/Domain');

const getWpClient = async (domainId) => {
  const domain = await Domain.findById(domainId);
  if (!domain || !domain.isWordPress) throw new Error('Invalid WordPress domain');
  return axios.create({
    baseURL: `${domain.url}`,
    auth: {
      username: domain.login,
      password: domain.apiPassword
    }
  });
};

exports.getPostByUrl = async (postUrl, domainId) => {
  try {
    const wpClient = await getWpClient(domainId);
    const slug = postUrl.split('/').filter(segment => segment).pop();
    console.log(`Attempting to fetch post for URL: ${postUrl}, slug: ${slug}, domainId: ${domainId}`);

    // Попытка поиска по слагу через /film
    console.log(`Fetching from /film endpoint with slug: ${slug}`);
    let response = await wpClient.get('/film', { params: { slug } });
    console.log(`Response from /film?slug=${slug}:`, response.data);
    if (response.data.length > 0) {
      console.log(`Found CPT post with ID: ${response.data[0].id}, slug: ${response.data[0].slug}`);
      return response.data[0];
    }

    // Попытка поиска по ID через /film/<id>
    if (/^\d+$/.test(slug)) {
      console.log(`Trying CPT 'film' by ID: ${slug}`);
      response = await wpClient.get(`/film/${slug}`);
      console.log(`Response from /film/${slug}:`, response.data);
      if (response.data.id) {
        console.log(`Found CPT post by ID: ${response.data.id}, slug: ${response.data.slug}`);
        return response.data;
      }
    }

    // Попытка поиска по слагу через /posts (для стандартных постов)
    console.log(`Fetching from /posts endpoint with slug: ${slug}`);
    response = await wpClient.get('/posts', { params: { slug } });
    console.log(`Response from /posts?slug=${slug}:`, response.data);
    if (response.data.length > 0) {
      console.log(`Found post with ID: ${response.data[0].id}, slug: ${response.data[0].slug}`);
      return response.data[0];
    }

    throw new Error(`Post not found for URL: ${postUrl}`);
  } catch (error) {
    console.error(`Error fetching post for URL ${postUrl}:`, error.message, error.response?.data || '');
    throw error;
  }
};

exports.updatePost = async (postId, data, domainId) => {
  try {
    const wpClient = await getWpClient(domainId);
    console.log(`Updating CPT 'film' post ${postId} with data:`, data);
    const response = await wpClient.post(`/film/${postId}`, data);
    console.log(`Updated CPT post ${postId}`);
    return response.data;
  } catch (error) {
    console.error(`Error updating CPT post ${postId}:`, error.message, error.response?.data || '');
    throw error;
  }
};