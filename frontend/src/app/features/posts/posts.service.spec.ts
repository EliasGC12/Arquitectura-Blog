import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { PostsService } from './posts.service';

describe('PostsService.exploreUrl', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
  });

  it('builds the public list and the category and tag filters', () => {
    const service = TestBed.inject(PostsService);

    expect(service.exploreUrl()).toBe('http://127.0.0.1:8001/api/posts/');
    expect(service.exploreUrl('arquitectura')).toBe(
      'http://127.0.0.1:8001/api/posts/?category=arquitectura',
    );
    expect(service.exploreUrl('arquitectura', 'fachada')).toBe(
      'http://127.0.0.1:8001/api/posts/?category=arquitectura&tag=fachada',
    );
    expect(service.exploreUrl('', 'fachada')).toBe('http://127.0.0.1:8001/api/posts/?tag=fachada');
  });
});
