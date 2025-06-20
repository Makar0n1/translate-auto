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
    const segments = postUrl.split('/').filter(segment => segment);
    const slug = segments.pop();
    let id = null;

    const idMatch = postUrl.match(/\/(\d+)\/?$/);
    if (idMatch) {
      id = idMatch[1];
    }
    console.log(`Attempting to fetch post for URL: ${postUrl}, slug: ${slug}, id: ${id}, domainId: ${domainId}`);

    if (id) {
      console.log(`Fetching from /film/${id}`);
      const response = await wpClient.get(`/film/${id}`);
      console.log(`Response from /film/${id}:`, response.data);
      if (response.data.id) {
        console.log(`Found CPT post with ID: ${response.data.id}, slug: ${response.data.slug}`);
        return { ...response.data, type: 'film' };
      }
    }

    console.log(`Fetching from /film endpoint with slug: ${slug}`);
    let response = await wpClient.get('/film', { params: { slug } });
    console.log(`Response from /film?slug=${slug}:`, response.data);
    if (response.data.length > 0) {
      console.log(`Found CPT post with ID: ${response.data[0].id}, slug: ${response.data[0].slug}`);
      const guidIdMatch = response.data[0].guid?.rendered?.match(/\/(\d+)\/?$/);
      const guidId = guidIdMatch ? guidIdMatch[1] : null;
      console.log(`Extracted guid ID: ${guidId}`);
      return { ...response.data[0], type: 'film', guidId };
    }

    console.log(`Fetching from /posts endpoint with slug: ${slug}`);
    response = await wpClient.get('/posts', { params: { slug } });
    console.log(`Response from /posts?slug=${slug}:`, response.data);
    if (response.data.length > 0) {
      console.log(`Found post with ID: ${response.data[0].id}, slug: ${response.data[0].slug}`);
      return { ...response.data[0], type: 'post' };
    }

    throw new Error(`Post not found for URL: ${postUrl}`);
  } catch (error) {
    console.error(`Error fetching post for URL ${postUrl}:`, error.message, error.response?.data || '');
    throw error;
  }
};

exports.updatePost = async (postId, data, domainId, postType = 'film') => {
  try {
    const wpClient = await getWpClient(domainId);
    const endpoint = postType === 'film' ? `/film/${postId}` : `/posts/${postId}`;
    console.log(`Updating post ${postId} with data:`, data, `at endpoint: ${endpoint}`);
    const response = await wpClient.post(endpoint, {
      content: data.content,
      meta: data.meta || {},
      yoast_head: data.yoast_head || undefined // Поддержка yoast_head
    });
    console.log(`Updated post ${postId} at endpoint ${endpoint}, response:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error updating post ${postId}:`, error.message, error.response?.data || '');
    throw error;
  }
};